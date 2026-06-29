// Copies the web app (single-source at repo root) into ./www for Capacitor.
// Run automatically by the npm scripts before `cap sync`.
import { copyFileSync, mkdirSync, existsSync } from 'fs';

const FILES = ['index.html', 'sw.js', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
if (!existsSync('www')) mkdirSync('www');
for (const f of FILES) {
  try { copyFileSync(f, 'www/' + f); console.log('copied', f); }
  catch (e) { console.warn('skip (missing):', f); }
}
console.log('www/ is ready for Capacitor.');
