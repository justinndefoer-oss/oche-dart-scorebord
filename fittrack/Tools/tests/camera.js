/* Drives the scanner through a real MediaStream: a canvas with a barcode drawn
   on it, exposed via canvas.captureStream() in place of getUserMedia. That
   covers the whole camera path — video element, cover-crop, both sweeps, decode
   — and the reported bug of scanning a second time. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');            // fittrack/
const APP = 'file://' + path.join(ROOT, 'index.html');
const OUT = process.env.FITTRACK_OUT || require('os').tmpdir();

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', d => d.accept());

  await page.route('**openfoodfacts.org**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 0, status_verbose: 'product not found' }) }));

  // fake camera
  await page.addInitScript(() => {
    const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
    const R = L.map(p => p.split('').map(c => c === '1' ? '0' : '1').join(''));
    const G = R.map(p => p.split('').reverse().join(''));
    const PAR = ['000000','001011','001101','001110','010011','011001','011100','010101','010110','011010'];
    const enc = code => {
      let b = '101'; const p = PAR[+code[0]];
      for (let i = 1; i <= 6; i++) b += (p[i - 1] === '0' ? L : G)[+code[i]];
      b += '01010';
      for (let i = 7; i <= 12; i++) b += R[+code[i]];
      return b + '101';
    };
    window.__cam = { code: null, rotated: false, canvas: null, timer: null, streams: [], calls: 0, fail: null };
    window.__paint = () => {
      const cam = window.__cam, cv = cam.canvas;
      if (!cv) return;
      const c = cv.getContext('2d'), W = cv.width, H = cv.height;
      c.fillStyle = '#8a8a8a'; c.fillRect(0, 0, W, H);              // cluttered-ish background
      for (let i = 0; i < 40; i++) { c.fillStyle = i % 2 ? '#6d6d6d' : '#9c9c9c';
        c.fillRect((i * 79) % W, (i * 53) % H, 40, 18); }
      if (!cam.code) return;
      const bits = enc(cam.code);
      c.save();
      c.translate(W / 2, H / 2);
      if (cam.rotated) c.rotate(Math.PI / 2);
      const along = Math.round(W * 0.62), across = Math.round(H * 0.34), mod = along / bits.length;
      c.fillStyle = '#fff';
      c.fillRect(-along / 2 - 30, -across / 2 - 14, along + 60, across + 28);   // label + quiet zone
      c.fillStyle = '#111';
      for (let b = 0; b < bits.length; b++) {
        if (bits[b] !== '1') continue;
        c.fillRect(-along / 2 + b * mod, -across / 2, Math.ceil(mod), across);
      }
      c.restore();
    };
    const md = navigator.mediaDevices || {};
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, get: () => md });
    md.getUserMedia = () => {
      const cam = window.__cam;
      cam.calls++;
      if (cam.fail) { const e = new Error('nope'); e.name = cam.fail; return Promise.reject(e); }
      // a live stream still held open would make a real device fail here
      const live = cam.streams.filter(s => s.getTracks().some(t => t.readyState === 'live'));
      if (live.length) { const e = new Error('busy'); e.name = 'NotReadableError'; return Promise.reject(e); }
      const cv = document.createElement('canvas');
      cv.width = 640; cv.height = 480;
      cam.canvas = cv;
      window.__paint();
      if (cam.timer) clearInterval(cam.timer);
      cam.timer = setInterval(window.__paint, 60);
      const stream = cv.captureStream(25);
      cam.streams.push(stream);
      return Promise.resolve(stream);
    };
    window.__realGUM = md.getUserMedia;                 // pristine, for restoring
    window.__restoreGUM = () => { navigator.mediaDevices.getUserMedia = window.__realGUM; };
  });

  await page.goto(APP);
  await page.waitForTimeout(300);

  const ok = [];
  const check = (n, c, x) => ok.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  → ' + x : ''));
    const setCode = (code, rotated) => page.evaluate(([c, r]) => {
    window.__cam.code = c; window.__cam.rotated = !!r; window.__paint();
  }, [code, rotated]);
  const draft = () => page.evaluate(() => entryDraft);
  const liveStreams = () => page.evaluate(() =>
    window.__cam.streams.filter(s => s.getTracks().some(t => t.readyState === 'live')).length);
  const waitDecode = async (ms) => {
    const until = Date.now() + (ms || 9000);
    while (Date.now() < until) {
      const t = await page.evaluate(() => {
        const s = SHEETS[SHEETS.length - 1];
        return s ? (s.kind || 'other') : 'none';
      });
      if (t !== 'scanner') return true;
      await page.waitForTimeout(150);
    }
    return false;
  };

  // ---- first scan ---- (start on a blank scene so we can observe the live state)
  await setCode(null, false);
  await page.click('.tabbar button[data-tab="food"]');
  await page.click('#screen-food [data-act="scanfoodtab"]');
  await page.waitForTimeout(900);
  const msg1 = await page.textContent('#scanmsg');
  check('camera reports it is scanning', msg1.indexOf('Scanning') >= 0, msg1.trim().slice(0, 50));
  check('nothing is read from a blank scene', await page.locator('#scanvid').count() === 1);
  await page.screenshot({ path: OUT + '60-camera-live.png' });

  await setCode('8712566441174', false);
  let decoded = await waitDecode();
  check('FIRST scan decodes a barcode from the camera', decoded);
  let d = await draft();
  check('first scan captured the right code', d.barcode === '8712566441174', d.barcode);
  check('stream released after the first scan', (await liveStreams()) === 0, String(await liveStreams()));

  // ---- second scan: the reported bug ----
  await setCode(null, false);
  await page.click('#sheet [data-act="scanentry"]');
  await page.waitForTimeout(900);
  const msg2 = await page.textContent('#scanmsg');
  check('SECOND scan starts the camera again', msg2.indexOf('Scanning') >= 0, msg2.trim().slice(0, 60));
  const calls = await page.evaluate(() => window.__cam.calls);
  check('camera was requested twice', calls === 2, String(calls));

  await setCode('5000112637922', false);
  decoded = await waitDecode();
  check('SECOND scan decodes', decoded);
  d = await draft();
  check('second scan captured the new code', d.barcode === '5000112637922', d.barcode);

  // ---- third, rotated ----
  await setCode(null, false);
  await page.click('#sheet [data-act="scanentry"]');
  await page.waitForTimeout(600);
  await setCode('3017620422003', true);
  decoded = await waitDecode();
  check('THIRD scan decodes a sideways barcode', decoded);
  d = await draft();
  check('rotated barcode read correctly', d.barcode === '3017620422003', d.barcode);
  check('no streams left running', (await liveStreams()) === 0, String(await liveStreams()));

  // ---- backing out while the camera is starting must not leave it on ----
  await page.evaluate(() => {
    const orig = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = (...a) =>
      new Promise(res => setTimeout(() => res(orig.apply(navigator.mediaDevices, a)), 700));
  });
  await setCode(null, false);
  await page.click('#sheet [data-act="scanentry"]');
  await page.waitForTimeout(120);
  await page.evaluate(() => popSheet());          // user taps back before the camera opens
  await page.waitForTimeout(1400);
  check('camera released when the user backs out mid-start', (await liveStreams()) === 0,
    String(await liveStreams()));
  const stillForm = await page.textContent('#sheet .sh h2');
  check('and the form underneath survives', stillForm.trim() === 'Add food', stillForm.trim());
  await page.evaluate(() => window.__restoreGUM());

  // ---- a camera that is busy on the first attempt must recover on its own ----
  await page.evaluate(() => {
    const cam = window.__cam;
    cam.busyOnce = true;
    const real = window.__realGUM;
    navigator.mediaDevices.getUserMedia = (...a) => {
      if (cam.busyOnce) { cam.busyOnce = false;
        const e = new Error('busy'); e.name = 'NotReadableError'; return Promise.reject(e); }
      return real.apply(navigator.mediaDevices, a);
    };
  });
  await setCode(null, false);
  await page.click('#sheet [data-act="scanentry"]');
  await page.waitForTimeout(1800);
  const recovered = await page.textContent('#scanmsg');
  check('a busy camera is retried automatically', recovered.indexOf('Scanning') >= 0,
    recovered.trim().slice(0, 60));
  await setCode('5449000000996', false);
  decoded = await waitDecode();
  check('and then decodes normally', decoded);

  // ---- a camera failure offers a retry that works ----
  await page.evaluate(() => { window.__restoreGUM(); window.__cam.fail = 'NotReadableError'; });
  await page.click('#sheet [data-act="scanentry"]');
  await page.waitForTimeout(2000);   // one auto-retry happens first
  let msg = await page.textContent('#scanmsg');
  check('camera failure is reported', msg.indexOf('did not start') >= 0, msg.trim().slice(0, 50));
  const hasRetry = await page.locator('#sheet [data-act="rescan"]').count();
  check('failure offers a retry button', hasRetry === 1, String(hasRetry));

  await setCode(null, false);
  await page.evaluate(() => { window.__cam.fail = null; });
  await page.click('#sheet [data-act="rescan"]');
  await page.waitForTimeout(700);
  await setCode('4008400402222', false);
  decoded = await waitDecode();
  check('retry recovers and decodes', decoded);
  d = await draft();
  check('code after retry is correct', d.barcode === '4008400402222', d.barcode);

  check('no streams leaked over the whole run', (await liveStreams()) === 0, String(await liveStreams()));

  console.log(ok.join('\n'));
  console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors'));
  console.log(ok.filter(l => l.startsWith('FAIL')).length + ' failing of ' + ok.length);
  await browser.close();
})();
