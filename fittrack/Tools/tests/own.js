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
  
  // ---- build your own, starting from the ready-made screen ----
  await page.click('.tabbar button[data-tab="train"]');
  await page.click('#screen-train [data-act="routines"]');
  await page.waitForTimeout(150);
  await page.click('#sheet [data-act="presets"]');
  await page.waitForTimeout(150);
  const btn = await page.locator('#sheet [data-act="newroutine"]').count();
  check('ready-made screen offers "build your own"', btn === 1, String(btn));

  await page.click('#sheet [data-act="newroutine"]');
  await page.waitForTimeout(200);
  const title = await page.textContent('#sheet .sh h2');
  check('opens the routine editor', title.trim() === 'New routine', title.trim());

  await page.fill('#sheet [data-r="name"]', 'My own split');
  await page.fill('#sheet [data-r="exname"][data-i="0"]', 'Zercher squat');
  await page.fill('#sheet [data-r="sets"][data-i="0"]', '4');
  await page.fill('#sheet [data-r="reps"][data-i="0"]', '6');
  await page.fill('#sheet [data-r="weight"][data-i="0"]', '70');
  await page.click('#sheet [data-act="addrex"]');
  await page.waitForTimeout(150);
  await page.fill('#sheet [data-r="exname"][data-i="1"]', 'Nordic curl');
  await page.fill('#sheet [data-r="sets"][data-i="1"]', '3');
  await page.fill('#sheet [data-r="reps"][data-i="1"]', '8');
  await page.click('#sheet [data-act="saverou"]');
  await page.waitForTimeout(250);

  let s = await S();
  const mine = s.routines.find(r => r.name === 'My own split');
  check('routine saved', !!mine, JSON.stringify(s.routines.map(r => r.name)));
  check('both exercises kept', mine && mine.exercises.length === 2,
    JSON.stringify(mine && mine.exercises.map(e => e.name)));
  check('sets/reps/weight stored', mine && mine.exercises[0].sets === 4 &&
    mine.exercises[0].reps === 6 && mine.exercises[0].weight === 70,
    JSON.stringify(mine && mine.exercises[0]));

  const backTitle = await page.textContent('#sheet .sh h2');
  check('lands back on the ready-made screen', backTitle.trim() === 'Ready-made routines', backTitle.trim());

  // it must be usable straight away
  await page.evaluate(() => { closeSheet(); openDayPlan(4); });   // Thursday
  await page.waitForTimeout(250);
  const inPlanner = await page.textContent('#sheet');
  check('new routine appears in the day planner', inPlanner.indexOf('My own split') >= 0);
  await page.screenshot({ path: OUT + '31-own-in-planner.png' });

  // ---- build your own from inside the day planner ----
  const btn2 = await page.locator('#sheet [data-act="newroutine"]').count();
  check('day planner offers it too', btn2 === 1, String(btn2));
  await page.click('#sheet [data-act="newroutine"]');
  await page.waitForTimeout(200);
  await page.fill('#sheet [data-r="name"]', 'Thursday cardio');
  await page.click('#sheet [data-act="rtype"][data-t="cardio"]');
  await page.waitForTimeout(150);
  await page.fill('#sheet [data-r="duration"]', '40');
  await page.fill('#sheet [data-r="distance"]', '7');
  await page.click('#sheet [data-act="saverou"]');
  await page.waitForTimeout(250);
  s = await S();
  const cardio = s.routines.find(r => r.name === 'Thursday cardio');
  check('cardio routine saved from the planner', cardio && cardio.type === 'cardio' &&
    cardio.duration === 40 && cardio.distance === 7, JSON.stringify(cardio &&
    { t: cardio.type, d: cardio.duration, km: cardio.distance }));
  const planTitle = await page.textContent('#sheet .sh h2');
  check('returns to the day it was planning', planTitle.trim() === 'Thursday', planTitle.trim());
  const listNow = await page.textContent('#sheet');
  check('shows up immediately in that day\'s list', listNow.indexOf('Thursday cardio') >= 0);

  // tick it, confirm the plan updates behind the sheet
  await page.click('#sheet [data-act="toggleplan"] >> nth=0');
  await page.waitForTimeout(200);
  s = await S();
  check('can be ticked onto the day', s.schedule['4'].length === 1, JSON.stringify(s.schedule['4']));
  await page.evaluate(() => closeSheet());
  await page.waitForTimeout(250);
  const thuRow = await page.textContent('#screen-train [data-act="planday"][data-dw="4"]');
  const thuName = await page.evaluate(() => routineById(STATE.schedule[4][0]).name);
  check('weekly plan row updated', thuRow.indexOf(thuName) >= 0, thuRow.trim());

  // ---- renaming a routine refreshes the plan chips ----
  // rename the routine that is actually ON Thursday, otherwise this proves nothing
  await page.evaluate(() => openRoutineEdit(STATE.schedule[4][0]));
  await page.waitForTimeout(200);
  await page.fill('#sheet [data-r="name"]', 'Renamed run');
  await page.click('#sheet [data-act="saverou"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => closeSheet());
  await page.waitForTimeout(250);
  const thuAfter = await page.textContent('#screen-train [data-act="planday"][data-dw="4"]');
  check('rename shows on the weekly plan without a reload',
    thuAfter.indexOf('Renamed run') >= 0, thuAfter.trim());

  await page.evaluate(() => { closeSheet(); openPresets(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '30-presets-own.png' });

  console.log(ok.join('\n'));
  console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors'));
  console.log(ok.filter(l => l.startsWith('FAIL')).length + ' failing of ' + ok.length);
  await browser.close();
})();
