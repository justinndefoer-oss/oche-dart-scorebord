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
position rows to build the rota. Rows are grouped under a named header per fitting room
(Lower Ground, 1st, 2nd, 3rd and 5th floor by default),
with numbered positions beneath each. Every name is editable, rooms and positions can be
added or removed, and deleting a room clears the placements on its rows rather than orphaning
them. A row can hold more than one person across the day; if two placements overlap in time
they stack into separate lanes and turn red.

Saves written before rooms existed are migrated on load: the flat position list becomes a
single "Fitting Room" group, keeping every row name, id and placement, and the migrated shape
is written back immediately so the store matches the screen.

When a room is added to the default list, `ROOMS_SEED_VERSION` is bumped and the list as it
stood at each version recorded in `ROOMS_SEEDED_AT`. An older save is topped up with exactly
the rooms added since — the delta between versions, deliberately *not* a name match against
the rooms present, because a room the user has renamed would fail that match and be added a
second time. The version guard also means a room deleted after the top-up stays deleted.

State (the parsed roster, position rows, and every placement) is kept in `localStorage`, so
a refresh doesn't lose your work. There's also a manual "+ Add person" form for anyone the
PDF parser missed or garbled, and a Print button for a paper copy of the current day.

## Hours are fixed, by construction

A person's times come from the roster and cannot be changed by placing them. The drop
x-coordinate is never read: `assignShift` records only which position row a shift went to,
and the block's position is computed from the shift's own start and end. Dropping the same
person at the far left, middle or far right of a row produces an identical block. While
dragging, a dashed preview snaps to those rostered hours wherever the cursor is, so the rule
is visible rather than something the user has to trust.

The one deliberate exception is the **+ Add person** form, which exists for people missing
from the PDF and therefore has to accept typed times. Using it for a name already in the
roster warns, since that is nearly always a mistake.

Note for future edits: the drop preview's class is `.drop-preview`, *not* `.ghost` —
`.ghost` is already the header's borderless-button style, and reusing it made those buttons
`position:absolute` and stacked them on top of the title.

## Import check

A silent mis-parse is the real risk here: a dropped shift means somebody quietly never
appears on the rota. So the import is checked against the PDF's own arithmetic rather than
trusted.

The export prints each person's weekly hours in its **Totaal** column, which is independent
of the shift times themselves. Breaks are deducted from that figure — measured across the
sample file, between 0 and 60 minutes per shift, never more — so a correct parse must satisfy

```
sum(shift lengths) - 60min × shifts  ≤  stated total  ≤  sum(shift lengths)
```

Anyone falling outside that band, having a total but no shifts at all, or ending up with an
unreadable name, is listed by name after every import (and via the **Check import** button).

On the 292-employee sample this gives **no false alarms** — all 292 reconcile. Against
deliberately corrupted data it caught 20/20 dropped shifts, 10/10 people whose shifts were
all lost, and 13/15 mangled end times; the two misses were mangles that happened to land
inside the break band, which is the known limit of the method. It cannot detect an error that
leaves the weekly total unchanged, such as two shifts swapped between days.

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
