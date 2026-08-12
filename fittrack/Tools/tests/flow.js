const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');            // fittrack/
const APP = 'file://' + path.join(ROOT, 'index.html');
const OUT = process.env.FITTRACK_OUT || require('os').tmpdir();

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', d => d.accept());   // auto-accept confirm()

  await page.goto(APP);
  await page.waitForTimeout(300);

  const ok = [];
  const check = (name, cond, extra) => ok.push((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  → ' + extra : ''));
  const S = () => page.evaluate(() => JSON.parse(localStorage.getItem('fittrack-state')));

  // ---- 1. log a food entry, saving it to the library ----
  await page.click('.tabbar button[data-tab="food"]');
  await page.click('#screen-food .meal .add');                                  // "Add breakfast"
  await page.fill('#sheet [data-d="name"]', 'Test oatmeal');
  await page.fill('#sheet [data-d="kcal"]', '250');
  await page.fill('#sheet [data-d="p"]', '10');
  await page.fill('#sheet [data-d="c"]', '42');
  await page.fill('#sheet [data-d="f"]', '5');
  await page.click('#sheet [data-act="togglelib"]');                       // save to library
  await page.fill('#sheet [data-d="serving"]', '60 g');
  await page.click('#sheet [data-act="serv"][data-v="1.5"]');              // 1.5 servings
  await page.click('#sheet [data-act="saveentry"]');
  await page.waitForTimeout(200);
  let s = await S();
  check('entry saved', s.entries.length === 1, JSON.stringify(s.entries[0] && {
    name: s.entries[0].name, servings: s.entries[0].servings, kcal: s.entries[0].kcal }));
  check('servings applied', s.entries[0] && s.entries[0].servings === 1.5);
  check('per-serving kcal stored (not multiplied)', s.entries[0] && s.entries[0].kcal === 250);
  check('food saved to library', s.foods.length === 1 && s.foods[0].serving === '60 g');
  check('entry links to food', s.entries[0] && s.entries[0].foodId === s.foods[0].id);
  const shownKcal = await page.textContent('#screen-food .meal .row .v');
  check('day list shows 375 kcal (250 x 1.5)', shownKcal.trim() === '375', shownKcal);

  // ---- 2. reuse it from the library via the picker ----
  await page.click('#screen-food .meal .add');
  await page.click('#sheet [data-act="pickfood"]');
  await page.waitForTimeout(150);
  await page.click('#sheet [data-act="usefood"]');
  await page.waitForTimeout(150);
  const nameVal = await page.inputValue('#sheet [data-d="name"]');
  const kcalVal = await page.inputValue('#sheet [data-d="kcal"]');
  check('picker filled the form', nameVal === 'Test oatmeal' && kcalVal === '250', nameVal + '/' + kcalVal);
  await page.click('#sheet [data-act="saveentry"]');
  await page.waitForTimeout(150);
  s = await S();
  check('second entry saved', s.entries.length === 2);
  check('library use count bumped', s.foods[0].uses === 2, String(s.foods[0].uses));

  // ---- 3. edit an entry ----
  await page.click('#screen-food .meal .row');
  await page.fill('#sheet [data-d="servings"]', '2');
  await page.click('#sheet [data-act="saveentry"]');
  await page.waitForTimeout(150);
  s = await S();
  check('edit kept one entry, changed servings', s.entries.length === 2 &&
    s.entries.some(e => e.servings === 2), JSON.stringify(s.entries.map(e => e.servings)));

  // ---- 4. day navigation does not leak into the future ----
  await page.click('#screen-food [data-act="day"][data-d="-1"]');
  let label = await page.textContent('#screen-food .daynav .d');
  check('back a day → Yesterday', label.trim() === 'Yesterday', label);
  const fwdDisabled = await page.getAttribute('#screen-food [data-act="day"][data-d="1"]', 'disabled');
  check('forward enabled on a past day', fwdDisabled === null);
  await page.click('#screen-food [data-act="day"][data-d="1"]');
  label = await page.textContent('#screen-food .daynav .d');
  check('forward a day → Today', label.trim() === 'Today', label);
  const fwdNow = await page.getAttribute('#screen-food [data-act="day"][data-d="1"]', 'disabled');
  check('forward disabled on today', fwdNow !== null);

  // ---- 5. log a strength workout with two exercises ----
  await page.click('.tabbar button[data-tab="train"]');
  await page.click('#screen-train [data-act="addworkout"]');
  await page.fill('#sheet [data-w="name"]', 'Test push');
  await page.fill('#sheet [data-w="exname"][data-i="0"]', 'Bench press');
  await page.fill('#sheet [data-w="reps"][data-i="0"][data-j="0"]', '8');
  await page.fill('#sheet [data-w="weight"][data-i="0"][data-j="0"]', '60');
  await page.click('#sheet [data-act="addset"][data-i="0"]');
  await page.waitForTimeout(120);
  const carried = await page.inputValue('#sheet [data-w="weight"][data-i="0"][data-j="1"]');
  check('new set copies the previous one', carried === '60', carried);
  await page.click('#sheet [data-act="addex"]');
  await page.waitForTimeout(120);
  await page.fill('#sheet [data-w="exname"][data-i="1"]', 'Overhead press');
  await page.fill('#sheet [data-w="reps"][data-i="1"][data-j="0"]', '10');
  await page.fill('#sheet [data-w="weight"][data-i="1"][data-j="0"]', '35');
  await page.click('#sheet [data-act="togglerou"]');                       // also save as routine
  await page.click('#sheet [data-act="saveworkout"]');
  await page.waitForTimeout(200);
  s = await S();
  check('workout saved', s.workouts.length === 1, JSON.stringify(s.workouts[0] && {
    name: s.workouts[0].name, ex: s.workouts[0].exercises.length }));
  check('two exercises, 2+1 sets', s.workouts[0] &&
    s.workouts[0].exercises.length === 2 &&
    s.workouts[0].exercises[0].sets.length === 2 &&
    s.workouts[0].exercises[1].sets.length === 1);
  check('routine created too', s.routines.length === 1 && s.routines[0].exercises.length === 2);

  // ---- 6. start a workout from that routine ----
  await page.click('#screen-train [data-act="routines"]');
  await page.waitForTimeout(150);
  await page.click('#sheet [data-act="startroutine"]');
  await page.waitForTimeout(200);
  const rname = await page.inputValue('#sheet [data-w="name"]');
  const rreps = await page.inputValue('#sheet [data-w="reps"][data-i="0"][data-j="0"]');
  check('routine prefilled the editor', rname === 'Test push' && rreps === '8', rname + '/' + rreps);
  await page.click('#sheet [data-act="saveworkout"]');
  await page.waitForTimeout(200);
  s = await S();
  check('second workout logged from routine', s.workouts.length === 2);

  // ---- 7. weight in lb converts back to kg on save ----
  await page.click('.tabbar button[data-tab="settings"]');
  await page.click('#screen-settings [data-act="wunit"][data-u="lb"]');
  await page.waitForTimeout(150);
  await page.click('.tabbar button[data-tab="weight"]');
  await page.click('#screen-weight [data-act="addweight"]');
  await page.fill('#sheet [data-wt="val"]', '176.4');
  await page.click('#sheet [data-act="saveweight"]');
  await page.waitForTimeout(200);
  s = await S();
  const kg = s.weights[0] && s.weights[0].kg;
  check('176.4 lb stored as ~80 kg', kg > 79.9 && kg < 80.1, String(kg));
  const shownW = await page.textContent('#weight-body .row .v');
  check('shown back as lb', shownW.indexOf('lb') > 0, shownW);

  // ---- 8. deleting a saved food leaves history intact ----
  await page.click('.tabbar button[data-tab="food"]');
  await page.click('#screen-food [data-act="library"]');
  await page.waitForTimeout(150);
  await page.click('#sheet [data-act="editfood"]');
  await page.waitForTimeout(150);
  await page.click('#sheet [data-act="delfood"]');
  await page.waitForTimeout(250);
  s = await S();
  check('food removed from library', s.foods.length === 0);
  check('logged entries survive with their numbers', s.entries.length === 2 &&
    s.entries.every(e => e.kcal === 250), JSON.stringify(s.entries.map(e => e.kcal)));

  // ---- 9. state survives a reload ----
  await page.reload();
  await page.waitForTimeout(300);
  const after = await S();
  check('data persisted across reload', after.entries.length === 2 && after.workouts.length === 2);
  const homeText = await page.textContent('#home-body');
  check('home renders after reload', homeText.indexOf('remaining') > 0 || homeText.indexOf('over goal') > 0);

  console.log(ok.join('\n'));
  console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors'));
  console.log(ok.filter(l => l.startsWith('FAIL')).length + ' failing of ' + ok.length);
  await browser.close();
})();
