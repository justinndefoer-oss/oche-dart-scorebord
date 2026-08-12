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

  let searchHits = 0;
  let mode = 'ok';
  await page.route('**openfoodfacts.org**', route => {
    const url = route.request().url();
    if (url.indexOf('/cgi/search.pl') > 0) {
      searchHits++;
      if (mode === 'fail') return route.abort();
      if (mode === 'empty') return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ products: [] }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [
        { code: '8712566441174', product_name: 'Hagelslag Puur', brands: 'De Ruijter', quantity: '380 g',
          nutriments: { 'energy-kcal_100g': 461, proteins_100g: 6.5, carbohydrates_100g: 68, fat_100g: 17 } },
        { code: '87343549', product_name: 'Vla Vanille', brands: 'Campina', quantity: '1 l',
          nutriments: { 'energy-kcal_100g': 97, proteins_100g: 3.2, carbohydrates_100g: 15, fat_100g: 2.6 } },
        { code: '111', product_name: 'No nutrition here', brands: '', nutriments: {} },
      ] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 0 }) });
  });

  await page.goto(APP);
  await page.waitForTimeout(300);

  const ok = [];
  const check = (n, c, x) => ok.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  → ' + x : ''));
  const draft = () => page.evaluate(() => entryDraft);
    const openSearch = () => page.evaluate(() => {
    closeSheet(); openEntrySheet({ day: todayKey(), meal: 'lunch' }); openPicker();
  });
  const type = async q => { await page.fill('#sheet [data-lib="search"]', q); await page.waitForTimeout(200); };

  // ---- bundled basics, offline ----
  await openSearch();
  await page.waitForTimeout(200);
  const idle = await page.textContent('#sheet');
  check('empty search explains itself', idle.indexOf('built-in basics') > 0);

  await type('banana');
  let txt = await page.textContent('#sheet');
  check('finds a bundled basic by name', txt.indexOf('Banana') > 0);
  check('basics section is labelled', txt.indexOf('Basics') > 0);

  await type('kip');
  txt = await page.textContent('#sheet');
  check('Dutch alias finds the English entry', txt.indexOf('Chicken breast') > 0, txt.indexOf('Chicken breast') > 0 ? '' : txt.slice(0, 120));

  await type('hagelslag');
  txt = await page.textContent('#sheet');
  check('Dutch staple is in the basics', txt.indexOf('Chocolate sprinkles') > 0);

  // pick one
  await type('banana');
  await page.click('#sheet [data-act="usebasic"]');
  await page.waitForTimeout(250);
  let d = await draft();
  check('picking a basic fills the form', d.name === 'Banana' && d.kcal === 89 && d.p === 1.1 && d.c === 23,
    JSON.stringify({ n: d.name, k: d.kcal }));
  check('basic is per 100 g', d.serving === '100 g', d.serving);
  check('basic does not force a library copy', d.saveLib === false);
  const back = await page.textContent('#sheet .sh h2');
  check('returns to the add-food form', back.trim() === 'Add food', back.trim());
  await page.screenshot({ path: OUT + '50-search-basics.png' });

  // ---- online search ----
  searchHits = 0;
  await openSearch();
  await type('ha');
  await page.waitForTimeout(800);
  check('no request for a two-letter query', searchHits === 0, String(searchHits));

  await type('hagelslag');
  await page.waitForTimeout(1200);
  check('one request after the debounce settles', searchHits === 1, String(searchHits));
  txt = await page.textContent('#sheet');
  check('online results render', txt.indexOf('De Ruijter Hagelslag Puur') > 0);
  check('products with no nutrition are dropped', txt.indexOf('No nutrition here') < 0);
  check('a litre product is treated as ml', txt.indexOf('per 100 ml') > 0);
  await page.screenshot({ path: OUT + '51-search-online.png' });

  await page.click('#sheet [data-act="useoff"]');
  await page.waitForTimeout(250);
  d = await draft();
  check('picking an online result fills the form', d.name === 'De Ruijter Hagelslag Puur' && d.kcal === 461);
  check('online pick keeps the barcode', d.barcode === '8712566441174', d.barcode);
  check('online pick saves to My Foods for offline reuse', d.saveLib === true);

  // typing fast must not fire a request per keystroke
  searchHits = 0;
  await openSearch();
  for (const q of ['h', 'ha', 'hag', 'hage', 'hagel', 'hagels', 'hagelsl']) {
    await page.fill('#sheet [data-lib="search"]', q);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1200);
  check('debounce collapses fast typing into one request', searchHits === 1, String(searchHits));

  // caret stays put while typing
  await openSearch();
  await page.click('#sheet [data-lib="search"]');
  await page.type('#sheet [data-lib="search"]', 'appel', { delay: 40 });
  await page.waitForTimeout(200);
  const caret = await page.evaluate(() => {
    const el = document.querySelector('#sheet [data-lib="search"]');
    return { v: el.value, at: el.selectionStart, focused: document.activeElement === el };
  });
  check('typing is not disrupted by redraws', caret.v === 'appel' && caret.at === 5 && caret.focused,
    JSON.stringify(caret));
  txt = await page.textContent('#sheet');
  check('Dutch "appel" finds Apple', txt.indexOf('Apple') > 0);

  // ---- failure and offline paths ----
  mode = 'empty';
  await openSearch();
  await type('zzzzqqq');
  await page.waitForTimeout(1200);
  txt = await page.textContent('#sheet');
  check('no online match is stated, not left blank', txt.indexOf('No packaged products match') > 0);

  mode = 'fail';
  await openSearch();
  await type('hagelslag');
  await page.waitForTimeout(1500);
  txt = await page.textContent('#sheet');
  check('a failed lookup offers a retry', txt.indexOf('Could not reach') > 0 && txt.indexOf('Try again') > 0);
  mode = 'ok';
  await page.click('#sheet [data-act="retryoff"]');
  await page.waitForTimeout(1300);
  txt = await page.textContent('#sheet');
  check('retry recovers', txt.indexOf('De Ruijter Hagelslag Puur') > 0);

  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }));
  await openSearch();
  await type('hagelslag');
  await page.waitForTimeout(900);
  txt = await page.textContent('#sheet');
  check('offline says so but still shows basics', txt.indexOf('Offline') > 0);
  await type('banana');
  txt = await page.textContent('#sheet');
  check('basics still work with no connection', txt.indexOf('Banana') > 0);
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true }));

  // ---- saved foods appear alongside ----
  await page.evaluate(() => {
    closeSheet();
    STATE.foods.push({ id: 'x1', name: 'My protein shake', serving: '30 g', kcal: 120, p: 24, c: 3, f: 1,
      barcode: '', created: Date.now(), lastUsed: Date.now(), uses: 3 });
    save();
  });
  await openSearch();
  await type('shake');
  txt = await page.textContent('#sheet');
  check('own foods are searched too', txt.indexOf('My protein shake') > 0 && txt.indexOf('My foods') > 0);

  console.log(ok.join('\n'));
  console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors'));
  console.log(ok.filter(l => l.startsWith('FAIL')).length + ' failing of ' + ok.length);
  await browser.close();
})();
