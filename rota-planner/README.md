# Rota Planner

A standalone tool for building a daily staff rota by hand, starting from a weekly roster
export. Single `index.html` (HTML + CSS + JS, no build step), plus two plain JS files and a
vendored copy of `pdf.js`. Unrelated to the dart scoreboard or FitTrack — no shared state,
no service worker, not a PWA.

Lives at **`/rota-planner/`** on the same GitHub Pages site:
https://justinndefoer-oss.github.io/oche-dart-scorebord/rota-planner/

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
