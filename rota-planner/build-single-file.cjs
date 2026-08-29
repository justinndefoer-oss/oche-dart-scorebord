#!/usr/bin/env node
// Bundles the rota planner into ONE self-contained rota-planner.html with no
// external files: pdf.js, its worker, the parser and the app are all inlined.
// That file can be copied onto a USB stick / emailed and opened by double-clicking,
// offline, with no server. Run:  node build-single-file.js
"use strict";

const fs = require("fs");
const path = require("path");

const dir = __dirname;
const read = (p) => fs.readFileSync(path.join(dir, p), "utf8");

const html = read("index.html");
const pdfLib = read("vendor/pdf.min.js");
const pdfWorker = read("vendor/pdf.worker.min.js");
const parser = read("rota-parser.js");
const app = read("rota-app.js");

// Inlining JS into <script> is only safe when the source can't terminate the tag.
for (const [name, src] of [["pdf.min.js", pdfLib], ["pdf.worker.min.js", pdfWorker],
                           ["rota-parser.js", parser], ["rota-app.js", app]]) {
  if (/<\/script/i.test(src) || /<!--/.test(src)) {
    throw new Error(`${name} contains a sequence that would break out of a <script> tag; ` +
                    `it needs escaping before it can be inlined.`);
  }
}

// The worker goes into a non-executed block; the app turns it into a Blob URL at runtime.
const workerTag = `<script id="pdfjs-worker-src" type="text/plain">\n${pdfWorker}\n</script>`;

let out = html;
// NOTE: the replacement MUST be passed as a function. With a string replacement,
// JS interprets $&, $`, $' and $1 inside it — and the app source legitimately
// contains "\\$&" (in cssEscape), which would splice the matched <script> tag
// into the middle of the code and truncate the bundle.
const replaceTag = (tag, replacement) => {
  if (!out.includes(tag)) throw new Error(`index.html no longer contains ${tag}`);
  out = out.replace(tag, () => replacement);
};

replaceTag('<script src="vendor/pdf.min.js"></script>',
  `${workerTag}\n<script>\n${pdfLib}\n</script>`);
replaceTag('<script src="rota-parser.js"></script>', `<script>\n${parser}\n</script>`);
replaceTag('<script src="rota-app.js"></script>', `<script>\n${app}\n</script>`);

// Nudge the title so it's obvious which build a stray file on a desktop is.
out = out.replace("<title>Rota Planner</title>", () => "<title>Rota Planner (offline)</title>");

// Guard against a silently truncated bundle: every source must survive intact.
for (const [name, src] of [["pdf.min.js", pdfLib], ["pdf.worker.min.js", pdfWorker],
                           ["rota-parser.js", parser], ["rota-app.js", app]]) {
  if (!out.includes(src)) {
    throw new Error(`${name} did not make it into the bundle intact — check the inlining.`);
  }
}
if (/<script src=/.test(out)) throw new Error("bundle still references an external script");

const outPath = path.join(dir, "rota-planner.html");
fs.writeFileSync(outPath, out);
console.log(`Wrote ${outPath} (${(Buffer.byteLength(out) / 1024 / 1024).toFixed(2)} MB)`);
