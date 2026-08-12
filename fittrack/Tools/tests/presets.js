const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');            // fittrack/
const APP = 'file://' + path.join(ROOT, 'index.html');
const OUT = process.env.FITTRACK_OUT || require('os').tmpdir();
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text()); });
  page.on('pageerror', e => errors.push('pageerror: '+e.message));
  page.on('dialog', d => d.accept());
  await page.goto(APP);
  await page.waitForTimeout(300);

  const ok=[]; const check=(n,c,x)=>ok.push((c?'PASS  ':'FAIL  ')+n+(x?'  → '+x:''));
  const S=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fittrack-state')));
  
  await page.click('.tabbar button[data-tab="train"]');
  await page.click('#screen-train [data-act="routines"]');
  await page.waitForTimeout(150);
  await page.click('#sheet [data-act="presets"]');
  await page.waitForTimeout(250);

  const groups = await page.locator('#sheet .card h2').count();
  check('every group is listed', groups === await page.evaluate(()=>PRESET_GROUPS.length), String(groups));
  const rows = await page.locator('#sheet [data-act="preset"]').count();
  check('every routine is listed', rows === await page.evaluate(()=>PRESETS.length), String(rows));
  const hint = await page.textContent('#sheet .hint');
  check('the count is stated up front', /\d+ routines/.test(hint), hint.trim().slice(0,40));
  await page.screenshot({ path: OUT+'70-presets-all.png' });

  // search by routine name
  await page.fill('#sheet [data-ps="search"]', '5×5');
  await page.waitForTimeout(200);
  let txt = await page.textContent('#sheet');
  check('search finds routines by name', txt.indexOf('5×5 Strength A')>0 && txt.indexOf('Push day')<0);

  // search by exercise inside the routine
  await page.fill('#sheet [data-ps="search"]', 'deadlift');
  await page.waitForTimeout(200);
  const found = await page.locator('#sheet [data-act="preset"]').count();
  const expect = await page.evaluate(()=>PRESETS.filter(p=>(p.ex||[]).some(e=>/deadlift/i.test(e[0]))||/deadlift/i.test(p.name)).length);
  check('search finds routines by exercise', found === expect && found > 3, found+' vs '+expect);
  await page.screenshot({ path: OUT+'71-presets-search.png' });

  // caret survives the redraw
  await page.fill('#sheet [data-ps="search"]', '');
  await page.click('#sheet [data-ps="search"]');
  await page.type('#sheet [data-ps="search"]', 'squat', { delay: 40 });
  await page.waitForTimeout(150);
  const caret = await page.evaluate(()=>{const el=document.querySelector('#sheet [data-ps="search"]');
    return {v:el.value, at:el.selectionStart, f:document.activeElement===el};});
  check('typing is not disrupted by redraws', caret.v==='squat'&&caret.at===5&&caret.f, JSON.stringify(caret));

  await page.fill('#sheet [data-ps="search"]', 'zzzz');
  await page.waitForTimeout(200);
  txt = await page.textContent('#sheet');
  check('no match says so', txt.indexOf('Nothing matches')>0);

  // open a 5/3/1 routine and check its notes survive into a real routine
  await page.fill('#sheet [data-ps="search"]', '5/3/1');
  await page.waitForTimeout(200);
  await page.click('#sheet [data-act="preset"]');
  await page.waitForTimeout(250);
  txt = await page.textContent('#sheet');
  check('detail shows the rep scheme note', txt.indexOf('Wendler')>0, txt.slice(0,60));
  await page.screenshot({ path: OUT+'72-preset-detail.png' });
  await page.click('#sheet [data-act="addpreset"]');
  await page.waitForTimeout(300);
  let s = await S();
  check('adding a preset copies its notes', s.routines.length===1 && /Wendler/.test(s.routines[0].notes),
    JSON.stringify(s.routines[0] && s.routines[0].notes||'').slice(0,50));
  check('weights start at zero', s.routines[0].exercises.every(e=>e.weight===0));

  // a 10x10 routine must survive the round trip intact
  await page.fill('#sheet [data-ps="search"]', 'German');
  await page.waitForTimeout(200);
  await page.click('#sheet [data-act="preset"]');
  await page.waitForTimeout(200);
  await page.click('#sheet [data-act="startpreset"]');
  await page.waitForTimeout(400);
  const setCount = await page.locator('#sheet [data-w="reps"][data-i="0"]').count();
  check('10x10 preset builds ten real sets', setCount===10, String(setCount));
  const firstReps = await page.inputValue('#sheet [data-w="reps"][data-i="0"][data-j="0"]');
  check('and ten reps each', firstReps==='10', firstReps);
  await page.click('#sheet [data-act="saveworkout"]');
  await page.waitForTimeout(300);
  s = await S();
  check('logged with all its sets', s.workouts.length===1 &&
    s.workouts[0].exercises[0].sets.length===10, JSON.stringify(s.workouts[0]&&s.workouts[0].exercises.map(e=>e.sets.length)));

  // cardio preset with notes
  await page.evaluate(()=>{ closeSheet(); openPresets(); });
  await page.fill('#sheet [data-ps="search"]', 'Tempo');
  await page.waitForTimeout(200);
  await page.click('#sheet [data-act="preset"]');
  await page.waitForTimeout(200);
  txt = await page.textContent('#sheet');
  check('cardio preset shows duration and distance', txt.indexOf('35 min')>0 && txt.indexOf('7')>0, txt.slice(0,80));

  console.log(ok.join('\n'));
  console.log('\n'+(errors.length?'ERRORS:\n'+errors.join('\n'):'no console/page errors'));
  console.log(ok.filter(l=>l.startsWith('FAIL')).length+' failing of '+ok.length);
  await browser.close();
})();
