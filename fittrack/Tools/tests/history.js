const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');            // fittrack/
const APP = 'file://' + path.join(ROOT, 'index.html');
const OUT = process.env.FITTRACK_OUT || require('os').tmpdir();
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  const errors=[]; page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(APP);
  await page.waitForTimeout(300);

  const ok=[]; const check=(n,c,x)=>ok.push((c?'PASS  ':'FAIL  ')+n+(x?'  → '+x:''));
  const S=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fittrack-state')));
  
  // three past squat sessions, progressively heavier
  await page.evaluate(()=>{
    const day=o=>{const d=new Date();d.setDate(d.getDate()-o);
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
    const ts=o=>{const d=new Date();d.setDate(d.getDate()-o);d.setHours(18,0,0,0);return d.getTime();};
    STATE.workouts=[2,5,9].map((o,i)=>({
      id:'w'+i, name:'5×5 Strength A', type:'strength', ts:ts(o), day:day(o), notes:'',
      duration:0, distance:0, burned:0,
      exercises:[
        {name:'Back squat', sets:[{reps:5,weight:60+i*-2.5,done:true},{reps:5,weight:60+i*-2.5,done:true},
                                  {reps:5,weight:60+i*-2.5,done:true}]},
        {name:'Bench press', sets:[{reps:5,weight:45,done:true},{reps:5,weight:47.5,done:true}]}
      ]}));
    STATE.routines=[{id:'r1',name:'5×5 Strength A',type:'strength',notes:'',duration:0,distance:0,
      created:Date.now(),lastUsed:null,
      exercises:[{name:'Back squat',sets:5,reps:5,weight:0},{name:'Bench press',sets:5,reps:5,weight:0},
                 {name:'Barbell row',sets:5,reps:5,weight:0}]}];
    save(); render();
  });

  // ---- starting a routine pulls last session's loads in ----
  await page.click('.tabbar button[data-tab="train"]');
  await page.click('#screen-train [data-act="routines"]');
  await page.waitForTimeout(200);
  await page.click('#sheet [data-act="startroutine"]');
  await page.waitForTimeout(300);
  const sq = await page.inputValue('#sheet [data-w="weight"][data-i="0"][data-j="0"]');
  check('routine prefills the last squat weight', sq === '60', sq);
  const bp0 = await page.inputValue('#sheet [data-w="weight"][data-i="1"][data-j="0"]');
  const bp1 = await page.inputValue('#sheet [data-w="weight"][data-i="1"][data-j="1"]');
  check('per-set weights are carried across', bp0 === '45' && bp1 === '47.5', bp0+'/'+bp1);
  const bp4 = await page.inputValue('#sheet [data-w="weight"][data-i="1"][data-j="4"]');
  check('extra sets repeat the last logged one', bp4 === '47.5', bp4);
  const row = await page.inputValue('#sheet [data-w="weight"][data-i="2"][data-j="0"]');
  check('an exercise with no history stays empty', row === '', JSON.stringify(row));
  const txt = await page.textContent('#sheet');
  check('shows what you did last time', txt.indexOf('Last time') > 0);
  check('shows the personal best', txt.indexOf('Best') > 0);
  check('reps still come from the routine', await page.inputValue('#sheet [data-w="reps"][data-i="0"][data-j="0"]') === '5');
  await page.screenshot({ path: OUT+'80-lasttime.png' });

  // ---- naming an exercise by hand pulls its history in ----
  await page.evaluate(()=>{ closeSheet(); openWorkoutSheet({}); });
  await page.waitForTimeout(200);
  await page.fill('#sheet [data-w="exname"][data-i="0"]', 'Back squat');
  await page.evaluate(()=>document.querySelector('#sheet [data-w="exname"][data-i="0"]').blur());
  await page.waitForTimeout(300);
  const filled = await page.inputValue('#sheet [data-w="weight"][data-i="0"][data-j="0"]');
  check('typing a known exercise fills its last load', filled === '60', filled);

  // and must never overwrite something already typed
  await page.evaluate(()=>{ closeSheet(); openWorkoutSheet({}); });
  await page.waitForTimeout(200);
  await page.fill('#sheet [data-w="weight"][data-i="0"][data-j="0"]', '80');
  await page.fill('#sheet [data-w="exname"][data-i="0"]', 'Back squat');
  await page.evaluate(()=>document.querySelector('#sheet [data-w="exname"][data-i="0"]').blur());
  await page.waitForTimeout(300);
  const kept = await page.inputValue('#sheet [data-w="weight"][data-i="0"][data-j="0"]');
  check('a weight you already typed is never overwritten', kept === '80', kept);

  // ---- records ----
  await page.evaluate(()=>closeSheet());
  await page.click('#screen-train [data-act="records"]');
  await page.waitForTimeout(300);
  const recTxt = await page.textContent('#sheet');
  check('records lists the exercises logged', recTxt.indexOf('Back squat')>0 && recTxt.indexOf('Bench press')>0);
  check('records shows the best set', recTxt.indexOf('5 × 60')>0, recTxt.slice(0,90));
  check('records counts sessions', recTxt.indexOf('3 sessions')>0);
  await page.screenshot({ path: OUT+'81-records.png' });

  await page.click('#sheet [data-act="exhist"]');
  await page.waitForTimeout(300);
  const hTxt = await page.textContent('#sheet');
  check('exercise history opens', hTxt.indexOf('Best set')>0 && hTxt.indexOf('Every session')>0);
  const hasChart = await page.locator('#sheet svg.lchart').count();
  check('history draws a top-set chart', hasChart === 1, String(hasChart));
  const goalLines = await page.locator('#sheet svg.lchart line.gl').count();
  check('no body-weight goal line on a lift chart', goalLines === 0, String(goalLines));
  await page.screenshot({ path: OUT+'82-exhistory.png' });

  // ---- editing an existing workout must not treat itself as "last time" ----
  await page.evaluate(()=>{ closeSheet(); openWorkoutSheet({id:'w0'}); });
  await page.waitForTimeout(300);
  const editTxt = await page.textContent('#sheet');
  const shownDay = await page.evaluate(()=>{
    const h=lastSetsFor('Back squat','w0'); return h?h.day:null; });
  const ownDay = await page.evaluate(()=>STATE.workouts.find(w=>w.id==='w0').day);
  check('editing a session compares against an earlier one, not itself',
    shownDay !== null && shownDay !== ownDay, shownDay+' vs own '+ownDay);
  check('edit view still shows a last-time hint', editTxt.indexOf('Last time')>0);

  // ---- weights survive in lb ----
  await page.evaluate(()=>{ closeSheet(); S().wUnit='lb'; save(); });
  await page.evaluate(()=>{ closeSheet(); openWorkoutSheet({routine:STATE.routines[0]}); });
  await page.waitForTimeout(300);
  const lb = await page.inputValue('#sheet [data-w="weight"][data-i="0"][data-j="0"]');
  check('history converts to the display unit', Math.abs(parseFloat(lb)-132.3) < 0.5, lb);
  await page.click('#sheet [data-act="saveworkout"]');
  await page.waitForTimeout(300);
  const s2 = await S();
  const saved = s2.workouts.find(w=>w.name==='5×5 Strength A' && w.id!=='w0' && w.id!=='w1' && w.id!=='w2');
  check('and is stored back in kg', saved && Math.abs(saved.exercises[0].sets[0].weight-60) < 0.1,
    saved ? String(saved.exercises[0].sets[0].weight) : 'none');

  console.log(ok.join('\n'));
  console.log('\n'+(errors.length?'ERRORS:\n'+errors.join('\n'):'no console/page errors'));
  console.log(ok.filter(l=>l.startsWith('FAIL')).length+' failing of '+ok.length);
  await browser.close();
})();
