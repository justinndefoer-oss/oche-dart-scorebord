const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');            // fittrack/
const APP = 'file://' + path.join(ROOT, 'index.html');
const OUT = process.env.FITTRACK_OUT || require('os').tmpdir();

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', d => d.accept());

  // Stand in for Open Food Facts — the real host is unreachable from this container.
  await page.route('**openfoodfacts.org**', route => {
    const url = route.request().url();
    if (url.indexOf('/8712566441174') > 0) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        status: 1, product: {
          product_name: 'Hagelslag Puur', brands: 'De Ruijter', quantity: '380 g',
          nutrition_data_per: '100g',
          nutriments: { 'energy-kcal_100g': 461, proteins_100g: 6.5, carbohydrates_100g: 68, fat_100g: 17 } } }) });
    }
    if (url.indexOf('/5449000000996') > 0) {   // a drink, and kJ only
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        status: 1, product: {
          product_name: 'Cola', brands: 'Coca-Cola', quantity: '1.5 l',
          nutrition_data_per: '100ml',
          nutriments: { energy_100g: 180, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0 } } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ status: 0, status_verbose: 'product not found' }) });
  });

  await page.goto(APP);
  await page.waitForTimeout(300);

  const ok = [];
  const check = (n, c, x) => ok.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  → ' + x : ''));
  const S = () => page.evaluate(() => JSON.parse(localStorage.getItem('fittrack-state')));
  const draft = () => page.evaluate(() => entryDraft);
    // mirrors what a user does: open the add-food form, tap Scan, camera reads a code
  const scan = (code, meal) => page.evaluate(([c, m]) => {
    closeSheet();
    openEntrySheet({ day: todayKey(), meal: m || 'lunch' });
    openScanner(applyScanToEntry);
    handleCode(c);
  }, [code, meal]);

  // the scanner UI renders (camera itself is unavailable headless)
  await page.click('.tabbar button[data-tab="food"]');
  await page.click('#screen-food [data-act="scanfoodtab"]');
  await page.waitForTimeout(400);
  const hasVideo = await page.locator('#scanvid').count();
  const hasManual = await page.locator('#scanmanual').count();
  check('scanner sheet renders a preview and a manual field', hasVideo === 1 && hasManual === 1);
  await page.screenshot({ path: OUT + '40-scanner.png' });
  const msg = await page.textContent('#scanmsg');
  check('camera failure is explained, not silent', msg.length > 10, msg.trim().slice(0, 60));

  // ---- 1. unknown barcode, product found online ----
  await page.evaluate(() => handleCode('8712566441174'));   // scanner already open from the header button
  await page.waitForTimeout(600);
  let d = await draft();
  check('online lookup fills the name', d.name === 'De Ruijter Hagelslag Puur', d.name);
  check('online lookup fills nutrition per 100 g',
    d.kcal === 461 && d.p === 6.5 && d.c === 68 && d.f === 17,
    JSON.stringify({ k: d.kcal, p: d.p, c: d.c, f: d.f }));
  check('serving labelled 100 g', d.serving === '100 g', d.serving);
  check('barcode kept on the draft', d.barcode === '8712566441174', d.barcode);
  check('auto-saves to My Foods so the next scan is offline', d.saveLib === true);
  const sheetTitle = await page.textContent('#sheet .sh h2');
  check('returns to the add-food form', sheetTitle.trim() === 'Add food', sheetTitle.trim());
  await page.screenshot({ path: OUT + '41-scanned-filled.png' });

  await page.click('#sheet [data-act="saveentry"]');
  await page.waitForTimeout(300);
  let s = await S();
  check('entry logged', s.entries.length === 1 && s.entries[0].kcal === 461);
  check('food saved with its barcode', s.foods.length === 1 && s.foods[0].barcode === '8712566441174',
    JSON.stringify(s.foods.map(f => f.barcode)));

  // ---- 2. same barcode again: served from the library, no network ----
  let netCalls = 0;
  page.on('request', r => { if (r.url().indexOf('openfoodfacts') > 0) netCalls++; });
  await scan('8712566441174', 'lunch');
  await page.waitForTimeout(500);
  d = await draft();
  check('second scan resolves from My Foods', d.name === 'De Ruijter Hagelslag Puur' && d.kcal === 461);
  check('and does not hit the network', netCalls === 0, String(netCalls));
  // the use counter tracks entries logged, not scans, so save before checking
  await page.click('#sheet [data-act="saveentry"]');
  await page.waitForTimeout(300);
  s = await S();
  check('logging it again bumps the library use count', s.foods[0].uses === 2, String(s.foods[0].uses));
  check('no duplicate food created for a re-scan', s.foods.length === 1, String(s.foods.length));

  // ---- 3. kJ-only drink converts to kcal, labelled ml ----
  await scan('5449000000996', 'snack');
  await page.waitForTimeout(600);
  d = await draft();
  check('kJ-only product converts to kcal', d.kcal === 43, String(d.kcal));   // 180 / 4.184
  check('drink labelled per 100 ml', d.serving === '100 ml', d.serving);

  // ---- 4. barcode not in the database ----
  await scan('9999999999994', 'dinner');
  await page.waitForTimeout(600);
  d = await draft();
  check('unknown barcode still attaches to the draft', d.barcode === '9999999999994', d.barcode);
  check('unknown barcode leaves the form blank to fill in', d.name === '' && d.kcal === 0);
  check('unknown barcode turns on save-to-library', d.saveLib === true);

  // fill it in by hand and confirm it is remembered
  await page.fill('#sheet [data-d="name"]', 'Local bakery bread');
  await page.fill('#sheet [data-d="kcal"]', '265');
  await page.click('#sheet [data-act="saveentry"]');
  await page.waitForTimeout(300);
  s = await S();
  const taught = s.foods.find(f => f.barcode === '9999999999994');
  check('manually filled barcode is remembered', !!taught && taught.name === 'Local bakery bread',
    JSON.stringify(taught && { n: taught.name, b: taught.barcode }));

  await scan('9999999999994', 'lunch');
  await page.waitForTimeout(400);
  d = await draft();
  check('re-scanning it now fills from the library', d.name === 'Local bakery bread' && d.kcal === 265,
    d.name + '/' + d.kcal);

  // ---- 5. offline ----
  await page.evaluate(() => { closeSheet(); Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); });
  await scan('4008400402222', 'snack');
  await page.waitForTimeout(500);
  d = await draft();
  check('offline scan does not hang, keeps the barcode', d.barcode === '4008400402222', d.barcode);
  check('offline scan still offers to remember it', d.saveLib === true);
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true }));

  // ---- 6. typed barcode, and rubbish input ----
  await page.evaluate(() => { closeSheet(); openEntrySheet({ day: todayKey(), meal: 'lunch' }); openScanner(applyScanToEntry); });
  await page.waitForTimeout(300);
  await page.fill('#scanmanual', '12345');
  await page.click('#sheet [data-act="manualcode"]');
  await page.waitForTimeout(300);
  const stillScanner = await page.textContent('#sheet .sh h2');
  check('too-short number is rejected', stillScanner.trim() === 'Scan barcode', stillScanner.trim());
  await page.fill('#scanmanual', '8712566441174');
  await page.click('#sheet [data-act="manualcode"]');
  await page.waitForTimeout(500);
  d = await draft();
  check('typed barcode resolves like a scan', d.name === 'De Ruijter Hagelslag Puur', d.name);

  // ---- 7. UPC-A (12 digits) normalises to the 13-digit form ----
  await scan('012000001086', 'lunch');
  await page.waitForTimeout(500);
  d = await draft();
  check('12-digit UPC-A stored as 13 digits', d.barcode === '0012000001086', d.barcode);

  // ---- 8. a slow lookup that lands after the user backs out must not steal the sheet ----
  await page.evaluate(() => {
    closeSheet();
    openEntrySheet({ day: todayKey(), meal: 'lunch' });
    openScanner(applyScanToEntry);
    popSheet();                       // user taps back while the lookup is in flight
    applyScanToEntry('8712566441174', null, 'new');   // late result arrives
  });
  await page.waitForTimeout(300);
  const survived = await page.textContent('#sheet .sh h2');
  check('late lookup does not close the form underneath', survived.trim() === 'Add food', survived.trim());

  // ---- 9. the camera is released when the sheet closes ----
  const camLive = await page.evaluate(() => { closeSheet(); return !!(SCAN.stream || SCAN.timer); });
  check('closing the sheet stops the scanner', camLive === false);

  console.log(ok.join('\n'));
  console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors'));
  console.log(ok.filter(l => l.startsWith('FAIL')).length + ' failing of ' + ok.length);
  await browser.close();
})();
