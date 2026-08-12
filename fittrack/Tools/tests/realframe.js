/* Realistic camera frames: a barcode on a label inside a cluttered scene, with
   a lighting gradient and a specular highlight — the conditions that a single
   global threshold per line cannot survive. Also re-runs each scene through the
   OLD global-threshold binariser to show the fix addresses the real cause. */
const fs = require('fs'), vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');            // fittrack/
const APPFILE = path.join(ROOT, 'index.html');
const APPJS = path.join(require('os').tmpdir(), 'fittrack-app.js');
require('fs').writeFileSync(APPJS,
  require('fs').readFileSync(APPFILE, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]);
const OUT = process.env.FITTRACK_OUT || require('os').tmpdir();

const js = fs.readFileSync(APPJS,'utf8') + ';globalThis.__rg=runsFromGray;globalThis.__ds=decodeScanline;';
const stub = new Proxy({}, { get: (t, k) => k === 'classList' ? { add(){}, remove(){}, toggle(){} }
  : k === 'querySelectorAll' ? () => [] : k === 'querySelector' ? () => stub : () => {}, set: () => true });
const ctx = { console, localStorage: { getItem: () => null, setItem() {} }, navigator: { onLine: true }, window: {},
  setTimeout, clearTimeout, setInterval, clearInterval,
  document: { querySelector: () => stub, querySelectorAll: () => [], getElementById: () => null,
    addEventListener() {}, createElement: () => stub, body: stub } };
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const runsFromGray = ctx.__rg, decodeScanline = ctx.__ds;

// the binariser as it was before this fix
function runsGlobal(gray, width) {
  let mn = 255, mx = 0;
  for (let x = 0; x < width; x++) { const v = gray[x]; if (v < mn) mn = v; if (v > mx) mx = v; }
  if (mx - mn < 40) return null;
  const t = (mn + mx) / 2;
  const runs = []; let cur = gray[0] < t, n = 0;
  const blackFirst = cur;
  for (let x = 0; x < width; x++) {
    const b = gray[x] < t;
    if (b === cur) n++; else { runs.push(n); cur = b; n = 1; }
  }
  runs.push(n);
  return { runs, blackFirst };
}

const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const R = L.map(p => p.split('').map(c => c === '1' ? '0' : '1').join(''));
const G = R.map(p => p.split('').reverse().join(''));
const PAR = ['000000','001011','001101','001110','010011','011001','011100','010101','010110','011010'];
function enc(code) {
  let b = '101'; const p = PAR[+code[0]];
  for (let i = 1; i <= 6; i++) b += (p[i - 1] === '0' ? L : G)[+code[i]];
  b += '01010';
  for (let i = 7; i <= 12; i++) b += R[+code[i]];
  return b + '101';
}

const W = 640, H = 480;
function scene(code, opt) {
  opt = opt || {};
  const rot = !!opt.rotated;
  const widthFrac = opt.widthFrac || 0.65;
  const lum = new Float64Array(W * H);
  const bgBase = opt.bgBase == null ? 120 : opt.bgBase;

  // cluttered background
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = bgBase + 18 * Math.sin(x / 37) + 12 * Math.cos(y / 23);
    if (((x >> 4) + (y >> 5)) % 7 === 0) v -= 45;              // dark blocks, like print
    lum[y * W + x] = v;
  }
  // white label panel
  const bits = enc(code);
  const along = Math.round((rot ? H : W) * widthFrac);
  const mod = along / bits.length;
  const across = Math.round((rot ? W : H) * (opt.tall || 0.34));
  const aStart = Math.round(((rot ? H : W) - along) / 2);
  const cStart = Math.round(((rot ? W : H) - across) / 2);
  const pad = Math.round(mod * 8);                              // quiet zone on the label
  for (let a = aStart - pad; a < aStart + along + pad; a++) {
    for (let c = cStart - 12; c < cStart + across + 12; c++) {
      const x = rot ? c : a, y = rot ? a : c;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      lum[y * W + x] = 232;
    }
  }
  // bars
  for (let b = 0; b < bits.length; b++) {
    if (bits[b] !== '1') continue;
    const s = aStart + Math.round(b * mod), e = aStart + Math.round((b + 1) * mod);
    for (let a = s; a < e; a++) for (let c = cStart; c < cStart + across; c++) {
      const x = rot ? c : a, y = rot ? a : c;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      lum[y * W + x] = 28;
    }
  }
  // lighting gradient across the frame (one side in shadow)
  if (opt.shadow !== false) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const f = 0.45 + 0.75 * (x / W);
      lum[y * W + x] *= f;
    }
  }
  // specular highlight somewhere OFF the barcode — this is what breaks a global threshold
  if (opt.glare !== false) {
    const gx = opt.glareX == null ? W * 0.08 : opt.glareX, gy = H * 0.5, gr = 55;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - gx, y - gy);
      if (d < gr) lum[y * W + x] += 210 * (1 - d / gr);
    }
  }
  // blur + noise
  const blur = opt.blur == null ? 1 : opt.blur;
  let cur = lum;
  for (let p = 0; p < blur; p++) {
    const cp = Float64Array.from(cur);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++)
      cur[y * W + x] = (cp[(y - 1) * W + x] + cp[(y + 1) * W + x] + cp[y * W + x - 1] + cp[y * W + x + 1] + cp[y * W + x] * 4) / 8;
  }
  const out = new Uint8Array(W * H);
  let seed = 987654321;
  for (let i = 0; i < W * H; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const n = ((seed / 0x7fffffff) - 0.5) * 2 * (opt.noise == null ? 6 : opt.noise);
    out[i] = Math.max(0, Math.min(255, Math.round(cur[i] + n)));
  }
  return out;
}

// mirrors scanTick's two sweeps
function sweep(lum, binariser, horizontalOnly) {
  const LINES = 16;
  const line = new Uint8Array(Math.max(W, H));
  const y0 = Math.round(H * 0.22), y1 = Math.round(H * 0.78);
  for (let li = 0; li < LINES; li++) {
    const y = y0 + Math.round((y1 - y0) * li / (LINES - 1));
    for (let x = 0; x < W; x++) line[x] = lum[y * W + x];
    const r = binariser(line, W);
    if (r) { const c = decodeScanline(r.runs, r.blackFirst); if (c) return c; }
  }
  if (horizontalOnly) return null;
  const x0 = Math.round(W * 0.10), x1 = Math.round(W * 0.90);
  for (let li = 0; li < LINES; li++) {
    const x = x0 + Math.round((x1 - x0) * li / (LINES - 1));
    for (let y = 0; y < H; y++) line[y] = lum[y * W + x];
    const r = binariser(line, H);
    if (r) { const c = decodeScanline(r.runs, r.blackFirst); if (c) return c; }
  }
  return null;
}

const CODES = ['8712566441174', '5000112637922', '3017620422003', '4008400402222'];
const SCENES = [
  ['upright on a cluttered shelf', {}],
  ['upright, small in frame', { widthFrac: 0.42 }],
  ['upright, big in frame', { widthFrac: 0.85 }],
  ['upright, heavy shadow gradient', { bgBase: 90, blur: 2 }],
  ['upright, glare next to the label', { glareX: 640 * 0.15 }],
  ['upright, short label strip', { tall: 0.18 }],
  ['sideways (rotated 90 degrees)', { rotated: true }],
  ['sideways, small in frame', { rotated: true, widthFrac: 0.45 }],
  ['sideways, blurred', { rotated: true, blur: 2 }],
];

const rows = [];
let newPass = 0, oldPass = 0, total = 0, newRotPass = 0, rotTotal = 0;
SCENES.forEach(([label, opt]) => {
  let nOK = 0, oOK = 0;
  CODES.forEach(code => {
    const lum = scene(code, opt);
    if (sweep(lum, runsFromGray) === code) nOK++;
    if (sweep(lum, runsGlobal) === code) oOK++;
  });
  total += CODES.length; newPass += nOK; oldPass += oOK;
  if (opt.rotated) { rotTotal += CODES.length; newRotPass += nOK; }
  rows.push((nOK === CODES.length ? 'PASS  ' : 'FAIL  ') + label.padEnd(34) +
    ' new ' + nOK + '/' + CODES.length + '   old ' + oOK + '/' + CODES.length);
});

// false positives must stay at zero on cluttered scenes with no barcode at all
let fp = 0;
for (let i = 0; i < 120; i++) {
  const lum = scene('8712566441174', { widthFrac: 0.65 });
  // wipe the label area to leave only clutter
  for (let k = 0; k < W * H; k++) if (lum[k] > 200 || lum[k] < 60) lum[k] = 120 + (k % 37);
  if (sweep(lum, runsFromGray)) fp++;
}

console.log(rows.join('\n'));
console.log('\ntotal   new ' + newPass + '/' + total + '   old ' + oldPass + '/' + total);
console.log('rotated new ' + newRotPass + '/' + rotTotal + '  (old binariser had no vertical sweep at all)');
console.log('false reads on cluttered scenes with no barcode: ' + fp + '/120');
