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

  await page.goto(APP);
  await page.waitForTimeout(300);

  const ok = [];
  const check = (n, c, x) => ok.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  → ' + x : ''));
  const S = () => page.evaluate(() => JSON.parse(localStorage.getItem('fittrack-state')));
  
  // --- old saves without a schedule must still load ---
  await page.evaluate(() => {
    localStorage.setItem('fittrack-state', JSON.stringify({
      v: 1, foods: [], entries: [], workouts: [], routines: [], weights: [],
      settings: { kcalGoal: 2000 } }));
  });
  await page.reload(); await page.waitForTimeout(300);
  const mem = await page.evaluate(() => STATE);
  check('old save without schedule migrates in memory', mem.schedule &&
    Array.isArray(mem.schedule['0']) && Object.keys(mem.schedule).length === 7,
    JSON.stringify(mem.schedule));
  check('existing settings preserved through migration', mem.settings.kcalGoal === 2000);
  await page.evaluate(() => save());
  let s = await S();
  check('schedule persists once anything is saved', s.schedule &&
    Object.keys(s.schedule).length === 7, JSON.stringify(s.schedule));

  // --- add presets ---
  await page.click('.tabbar button[data-tab="train"]');
  await page.click('#screen-train [data-act="routines"]');
  await page.waitForTimeout(150);
  await page.click('#sheet [data-act="presets"]');
  await page.waitForTimeout(150);
  const groupCount = await page.locator('#sheet .card h2').count();
  const PRESET_GROUP_COUNT = await page.evaluate(() => PRESET_GROUPS.length);
  check('preset groups listed', groupCount === PRESET_GROUP_COUNT, groupCount + ' vs ' + PRESET_GROUP_COUNT);
  const faIdx = await page.evaluate(() => PRESETS.findIndex(p => p.name === 'Full Body A'));
  await page.click('#sheet [data-act="preset"][data-i="' + faIdx + '"]');
  await page.waitForTimeout(150);
  const exRows = await page.locator('#sheet .card').nth(1).locator('.row').count();
  check('preset detail lists its exercises', exRows === 5, String(exRows));
  await page.click('#sheet [data-act="addpreset"]');
  await page.waitForTimeout(200);
  s = await S();
  check('preset copied into my routines', s.routines.length === 1 && s.routines[0].name === 'Full Body A',
    JSON.stringify(s.routines.map(r => r.name)));
  check('preset weights start at 0', s.routines[0].exercises.every(e => e.weight === 0));
  check('preset sets/reps carried over', s.routines[0].exercises[0].sets === 3 &&
    s.routines[0].exercises[0].reps === 8);

  // add a second and a cardio one
  const fbIdx = await page.evaluate(() => PRESETS.findIndex(p => p.name === 'Full Body B'));
  await page.click('#sheet [data-act="preset"][data-i="' + fbIdx + '"]');
  await page.waitForTimeout(120);
  await page.click('#sheet [data-act="addpreset"]');
  await page.waitForTimeout(150);
  // pick by name, not by index — the library gets reordered as routines are added
  const runIdx = await page.evaluate(() => PRESETS.findIndex(p => p.name === 'Easy run 5 km'));
  await page.click('#sheet [data-act="preset"][data-i="' + runIdx + '"]');
  await page.waitForTimeout(120);
  await page.click('#sheet [data-act="addpreset"]');
  await page.waitForTimeout(150);
  s = await S();
  check('three routines now', s.routines.length === 3, JSON.stringify(s.routines.map(r => r.name)));
  const run = s.routines.find(r => r.type === 'cardio');
  check('cardio preset keeps duration and distance', run && run.duration === 30 && run.distance === 5,
    JSON.stringify(run && { d: run.duration, km: run.distance }));

  await page.evaluate(() => closeSheet());
  await page.waitForTimeout(200);

  // --- assign routines to weekdays ---
  const todayDow = await page.evaluate(() => new Date().getDay());
  await page.click('#screen-train [data-act="planday"][data-dw="1"]');   // Monday
  await page.waitForTimeout(200);
  await page.click('#sheet [data-act="toggleplan"]');                    // first routine
  await page.waitForTimeout(150);
  s = await S();
  check('Monday got a routine', s.schedule['1'].length === 1, JSON.stringify(s.schedule['1']));
  await page.click('#sheet .row:nth-of-type(2) [data-act="toggleplan"], #sheet [data-act="toggleplan"] >> nth=1');
  await page.waitForTimeout(150);
  s = await S();
  check('Monday can hold two routines', s.schedule['1'].length === 2, JSON.stringify(s.schedule['1']));
  await page.click('#sheet [data-act="toggleplan"] >> nth=1');           // untick the second
  await page.waitForTimeout(150);
  s = await S();
  check('ticking again removes it', s.schedule['1'].length === 1);
  await page.evaluate(() => closeSheet());
  await page.waitForTimeout(200);
  const monRow = await page.textContent('#screen-train [data-act="planday"][data-dw="1"]');
  const monName = await page.evaluate(() => routineById(STATE.schedule[1][0]).name);
  check('Monday row shows the routine it holds', monRow.indexOf(monName) >= 0,
    monRow.trim() + ' | expected ' + monName);
  const tueRow = await page.textContent('#screen-train [data-act="planday"][data-dw="2"]');
  check('empty day reads as Rest day', tueRow.indexOf('Rest day') >= 0, tueRow.trim());

  // --- today's plan reaches the Home screen with a Start button ---
  await page.evaluate(d => {
    STATE.schedule[d] = [STATE.routines[0].id];
    save(); render();
  }, todayDow);
  await page.click('.tabbar button[data-tab="home"]');
  await page.waitForTimeout(250);
  const homeTxt = await page.textContent('#home-body');
  check('today\'s planned routine shows on Home', homeTxt.indexOf('Full Body A') >= 0);
  const startBtn = await page.locator('#home-body [data-act="startroutine"]').count();
  check('Home offers a Start button', startBtn === 1, String(startBtn));
  await page.screenshot({ path: OUT + '20-home-planned.png' });

  // --- starting from the plan prefills and logs ---
  await page.click('#home-body [data-act="startroutine"]');
  await page.waitForTimeout(250);
  const wname = await page.inputValue('#sheet [data-w="name"]');
  check('plan Start prefills the editor', wname === 'Full Body A', wname);
  await page.click('#sheet [data-act="saveworkout"]');
  await page.waitForTimeout(250);
  s = await S();
  check('workout logged from the plan', s.workouts.length === 1);
  const homeAfter = await page.textContent('#home-body');
  check('planned item disappears once logged', (homeAfter.match(/Full Body A/g) || []).length === 1,
    'occurrences: ' + (homeAfter.match(/Full Body A/g) || []).length);
  const startAfter = await page.locator('#home-body [data-act="startroutine"]').count();
  check('Start button gone after logging it', startAfter === 0, String(startAfter));

  // --- deleting a routine cleans the plan ---
  await page.click('.tabbar button[data-tab="train"]');
  await page.click('#screen-train [data-act="routines"]');
  await page.waitForTimeout(200);
  await page.click('#sheet [data-act="editroutine"]');
  await page.waitForTimeout(200);
  await page.click('#sheet [data-act="delrou"]');
  await page.waitForTimeout(300);
  s = await S();
  const allIds = s.routines.map(r => r.id);
  const dangling = Object.keys(s.schedule).some(d => s.schedule[d].some(x => allIds.indexOf(x) < 0));
  check('no dangling routine ids left in the plan', !dangling, JSON.stringify(s.schedule));

  await page.evaluate(() => closeSheet());
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '21-train-plan.png' });
  await page.evaluate(() => { showTab('train'); openDayPlan(3); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '22-dayplan.png' });
  await page.evaluate(() => { closeSheet(); openPresets(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '23-presets.png' });

  console.log(ok.join('\n'));
  console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors'));
  console.log(ok.filter(l => l.startsWith('FAIL')).length + ' failing of ' + ok.length);
  await browser.close();
})();
