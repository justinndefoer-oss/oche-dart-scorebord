# Rota Planner

A standalone tool for building a daily staff rota by hand, starting from a weekly roster
export. Unrelated to the dart scoreboard or FitTrack — no shared state, no service worker,
not a PWA.

## Two ways to run it

**`rota-planner.html` — one self-contained file (the one to actually use).** Everything is
inlined: pdf.js, its worker, the parser and the app. Copy it onto a USB stick, email it to
yourself, put it on a desktop — double-click and it works, offline, with no server and no
folder around it. This is the file to take to work.

**`index.html` + `rota-parser.js` + `rota-app.js` + `vendor/`** — the same app as separate
source files, which is what you edit. Also served on GitHub Pages at
https://justinndefoer-oss.github.io/oche-dart-scorebord/rota-planner/

After changing any source file, regenerate the single-file build:

```
node build-single-file.cjs
```

Both builds run from one source; `rota-app.js` picks the worker up from `vendor/` when the
files are separate, and from the inlined block when they aren't. If a browser refuses to
spawn a worker from a `file://` page, it falls back to parsing on the main thread (a ~660 KB,
17-page roster takes well under a second either way).

Two things to know if you touch `build-single-file.cjs`: the replacements must be passed as
functions, because the app source legitimately contains `"\\$&"` and a string replacement
would splice the matched tag into the code; and the build refuses to write a bundle where any
source failed to survive intact, which is what catches that class of bug.

## What it does

Upload a weekly "Node Weekrooster" PDF export (the kind with a Persnr./Naam column, one
column per weekday, and a Totaal column) and the app extracts every name, which day(s) they
work, and their exact hours — entirely client-side, nothing is uploaded anywhere. Each
person+day+shift becomes a chip in that day's "available" pool. A person only ever appears
on the day(s) and at the hours their contract row actually shows — there is no way to place
someone on a day they don't work, or edit their hours, by design.

For each day (a fixed 07:00–22:30 window) you drag — or tap, then tap a row — chips onto
freeform "position" rows to build the rota. A position row can hold more than one person
across the day (e.g. a till covered by two people back to back); if two placements overlap
in time they render side by side and turn red so it's obvious. Rows are freeform on purpose:
this version doesn't know about departments or floors, just "Position 1, 2, 3…", renamed to
whatever you want.

State (the parsed roster, position rows, and every placement) is kept in `localStorage`, so
a refresh doesn't lose your work. There's also a manual "+ Add person" form for anyone the
PDF parser missed or garbled, and a Print button for a paper copy of the current day.

## PDF parsing

`rota-parser.js` reads text positions per page via `pdf.js` (`getTextContent`), clusters
words into visual rows by y-coordinate, and maps each row's x-coordinates onto the day
columns detected from the header row (whatever 7 labels sit between "Naam" and "Totaal" —
the day names themselves aren't hardcoded, only those two structural anchors are). Multi-line
wrapped names and split shifts on the same day are handled by carrying the "current
employee" forward across continuation rows. Validated against a real 17-page, 292-employee
export with zero mismatches against a from-scratch reference parse.

If a future export doesn't match this structure, the day columns won't be found and the app
shows a warning — names can still be added by hand.
