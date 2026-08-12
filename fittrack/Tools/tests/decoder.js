/* Unit-test the barcode decoder by encoding known numbers, rendering them as
   pixel scanlines the way a camera would, and decoding them back. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');            // fittrack/
const APPFILE = path.join(ROOT, 'index.html');
const APPJS = path.join(require('os').tmpdir(), 'fittrack-app.js');
require('fs').writeFileSync(APPJS,
  require('fs').readFileSync(APPFILE, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]);
const OUT = process.env.FITTRACK_OUT || require('os').tmpdir();
const vm = require('vm');

const html = fs.readFileSync(APPFILE, 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Run the app's JS with just enough DOM stubbed out to reach the decoder.
const stubEl = new Proxy({}, {
  get: (t, k) => (k === 'innerHTML' || k === 'value' || k === 'textContent') ? ''
    : (k === 'classList') ? { add(){}, remove(){}, toggle(){} }
    : (k === 'style') ? {}
    : (k === 'dataset') ? {}
    : (k === 'querySelector' || k === 'closest') ? () => stubEl
    : (k === 'querySelectorAll') ? () => []
    : (k === 'addEventListener' || k === 'focus' || k === 'setSelectionRange') ? () => {}
    : undefined,
  set: () => true,
});
const ctx = {
  console,
  localStorage: { getItem: () => null, setItem() {} },
  navigator: { onLine: true },
  window: {},
  setTimeout, clearTimeout, setInterval, clearInterval,
  document: {
    querySelector: () => stubEl,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {},
    createElement: () => stubEl,
    body: stubEl,
  },
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(js, ctx);

const { decodeScanline, runsFromGray, checkEAN13, checkEAN8, normaliseCode } = ctx;

// ---- encoders (independent of the decoder, written from the EAN spec) ----
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const R = L.map(p => p.split('').map(c => c === '1' ? '0' : '1').join(''));
const G = R.map(p => p.split('').reverse().join(''));
const PARITY = ['000000','001011','001101','001110','010011','011001','011100','010101','010110','011010'];

function ean13Check(d12) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += (+d12[i]) * (i % 2 ? 3 : 1);
  return String((10 - (s % 10)) % 10);
}
function ean8Check(d7) {
  let s = 0;
  for (let i = 0; i < 7; i++) s += (+d7[i]) * (i % 2 ? 1 : 3);
  return String((10 - (s % 10)) % 10);
}
function encodeEAN13(code) {
  const par = PARITY[+code[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (par[i - 1] === '0' ? L : G)[+code[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[+code[i]];
  return bits + '101';
}
function encodeEAN8(code) {
  let bits = '101';
  for (let i = 0; i < 4; i++) bits += L[+code[i]];
  bits += '01010';
  for (let i = 4; i < 8; i++) bits += R[+code[i]];
  return bits + '101';
}

// ---- render bits to a greyscale scanline, like a camera would see it ----
function render(bits, opts) {
  opts = opts || {};
  const mod = opts.module || 3;            // pixels per module
  const quiet = opts.quiet == null ? 12 : opts.quiet;
  const dark = opts.dark == null ? 30 : opts.dark;
  const light = opts.light == null ? 225 : opts.light;
  const noise = opts.noise || 0;
  const skew = opts.skew || 0;             // module width drift across the line
  const blur = opts.blur || 0;

  const px = [];
  for (let i = 0; i < quiet; i++) px.push(light);
  for (let b = 0; b < bits.length; b++) {
    const w = Math.max(1, Math.round(mod * (1 + skew * (b / bits.length - 0.5))));
    for (let k = 0; k < w; k++) px.push(bits[b] === '1' ? dark : light);
  }
  for (let i = 0; i < quiet; i++) px.push(light);

  let out = Float64Array.from(px);
  for (let pass = 0; pass < blur; pass++) {
    const cp = Float64Array.from(out);
    for (let i = 1; i < out.length - 1; i++) out[i] = (cp[i - 1] + cp[i] * 2 + cp[i + 1]) / 4;
  }
  const gray = new Uint8Array(out.length);
  let seed = 12345;
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const n = noise ? ((seed / 0x7fffffff) - 0.5) * 2 * noise : 0;
    gray[i] = Math.max(0, Math.min(255, Math.round(out[i] + n)));
  }
  return gray;
}
function decode(gray) {
  const r = runsFromGray(gray, gray.length);
  if (!r) return null;
  return decodeScanline(r.runs, r.blackFirst);
}

// ---- tests ----
const results = [];
const check = (n, c, x) => results.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  → ' + x : ''));

// known real-world barcodes
const KNOWN = ['5000112637922', '3017620422003', '8712566441174', '4008400402222', '0012000001086'];
KNOWN.forEach(code => {
  const got = decode(render(encodeEAN13(code)));
  check('decodes ' + code, got === code, String(got));
});

// exhaustive-ish round trip: 300 random EAN-13
let ok = 0, bad = [];
for (let i = 0; i < 300; i++) {
  let d = '';
  for (let k = 0; k < 12; k++) d += Math.floor(Math.random() * 10);
  const code = d + ean13Check(d);
  const got = decode(render(encodeEAN13(code)));
  if (got === code) ok++; else bad.push(code + '→' + got);
}
check('300 random EAN-13 round trip', ok === 300, ok + '/300' + (bad.length ? ' e.g. ' + bad[0] : ''));

// EAN-8
let ok8 = 0;
for (let i = 0; i < 200; i++) {
  let d = '';
  for (let k = 0; k < 7; k++) d += Math.floor(Math.random() * 10);
  const code = d + ean8Check(d);
  if (decode(render(encodeEAN8(code))) === code) ok8++;
}
check('200 random EAN-8 round trip', ok8 === 200, ok8 + '/200');

// upside down
const rev = KNOWN[0];
const flipped = Uint8Array.from(render(encodeEAN13(rev))).reverse();
check('reads a barcode scanned upside down', decode(flipped) === rev, String(decode(flipped)));

// realistic camera degradation
const conds = [
  ['small (2px modules, near the readable limit)', { module: 2 }],
  ['small (2px modules)', { module: 2 }],
  ['large (6px modules)', { module: 6 }],
  ['low contrast', { dark: 95, light: 165 }],
  ['noisy', { noise: 18 }],
  ['blurred', { blur: 3 }],
  ['blurred + noisy', { blur: 2, noise: 12 }],
  ['tilted (12% width drift)', { skew: 0.12 }],
  ['tilted + blurred', { skew: 0.1, blur: 2 }],
  ['dim and noisy', { dark: 60, light: 130, noise: 14, blur: 1 }],
];
conds.forEach(([label, opt]) => {
  let hit = 0;
  KNOWN.forEach(code => { if (decode(render(encodeEAN13(code), Object.assign({ module: 3 }, opt))) === code) hit++; });
  check('reads when ' + label, hit === KNOWN.length, hit + '/' + KNOWN.length);
});

// it must NOT invent codes out of nothing
let falsePos = 0;
for (let i = 0; i < 400; i++) {
  const n = 300 + Math.floor(Math.random() * 200);
  const g = new Uint8Array(n);
  for (let x = 0; x < n; x++) g[x] = Math.floor(Math.random() * 256);
  if (decode(g)) falsePos++;
}
check('no false reads from 400 random noise lines', falsePos === 0, String(falsePos));

let flatMiss = 0;
for (let i = 0; i < 100; i++) {
  const g = new Uint8Array(400).fill(200);
  if (decode(g)) flatMiss++;
}
check('no false reads from blank lines', flatMiss === 0, String(flatMiss));

// a corrupted barcode must be rejected, not misreported
let corrupt = 0;
for (let i = 0; i < 200; i++) {
  let d = '';
  for (let k = 0; k < 12; k++) d += Math.floor(Math.random() * 10);
  const code = d + ean13Check(d);
  const bits = encodeEAN13(code).split('');
  for (let k = 0; k < 6; k++) {
    const at = 5 + Math.floor(Math.random() * (bits.length - 10));
    bits[at] = bits[at] === '1' ? '0' : '1';
  }
  const got = decode(render(bits.join('')));
  if (got && got !== code) corrupt++;
}
check('damaged barcodes are rejected, never misread', corrupt === 0, String(corrupt));

// checksum helpers
check('checkEAN13 accepts a valid code', checkEAN13('5000112637922') === true);
check('checkEAN13 rejects a bad check digit', checkEAN13('5000112637921') === false);
check('checkEAN8 accepts a valid code', checkEAN8('96385074') === true);
check('UPC-A is normalised to 13 digits', normaliseCode('012000001086') === '0012000001086',
  normaliseCode('012000001086'));

console.log(results.join('\n'));
console.log('\n' + results.filter(r => r.startsWith('FAIL')).length + ' failing of ' + results.length);
