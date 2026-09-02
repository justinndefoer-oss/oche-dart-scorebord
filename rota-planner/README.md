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

For each day (a fixed 07:00–22:30 window, marked every half hour — hours labelled on the top
line of the ruler, half hours on the line below, so an hour label and the half hour after it
never compete for the same space) you drag — or tap, then tap a row — chips onto
position rows to build the rota. Rows are grouped under a named header per fitting room
(Lower Ground, 1st, 2nd, 3rd and 5th floor by default),
with numbered positions beneath each. Every name is editable, rooms and positions can be
added or removed, and deleting a room clears the placements on its rows rather than orphaning
them.

Each room's **+ Position** and **×** sit immediately after its name, not pushed to the right
of the header: the header lives inside the horizontally-scrolling timeline, so right-aligned
controls ended up around x=1066 and were off-screen on a phone. The delete crosses are also
faintly visible at rest rather than appearing on hover, because a touch screen never hovers
and hover-only controls are invisible there for good. A row can hold more than one person across the day, and two of them may overlap in time —
a handover, or extra cover at a busy hour. That is normal, so it is not flagged: overlapping
placements simply stack into separate lanes so both stay readable, and both are counted in
the On duty strip for the slots they share.

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
PDF parser missed or garbled.

## Filtering the pool by department

The roster gives every person a department, so the pool can be narrowed to one instead of
scrolling all 292 names. The picker lists every department **rostered that day** — built from
everyone rostered, not just the unplaced, so a department doesn't vanish from the list the
moment you place its last person — with the number still to place beside each. The choice is
saved: whoever runs the fitting rooms wants the same department every day.

A department kept across a day it has nobody on stays in the list at `(0)` and stays selected,
rather than the control silently resetting itself to All; the pool then says nobody from it
works that day, which is a different thing from everyone having been placed and reads
differently. A department saved from a previous week that isn't in the new export at all does
fall back to All, since there is nothing to select.

**The export clips department names.** They print as `NAME(costcentre)` into a fixed-width
column and anything past roughly 155pt is cut — in the sample file 10 of 33 arrive already
truncated, e.g. `FITTING ROOMS 1ST FLOOR(33`. Those characters are not in the PDF, so no parser
can recover them. `prettyDept` drops the cost centre (noise in a filter) and title-cases the
rest; where the *name itself* lost letters — three of them, Lower Ground, Fourth Floor and
Health and Beauty — it keeps an ellipsis so it reads as truncated rather than as a typo of ours.
Two rules earn their place in `titleCase`: an ampersand or dot keeps a token's capitals, so
`P&C` doesn't become `P&c`; and it capitalises the first *letter* rather than the first
character, because `(HEALTH` starts with a bracket and upper-casing that did nothing. Length
alone is not a test for an acronym — it left `MENS`, `AND` and the clipped `FLOO` shouting.

The source spelling is left alone, typos included: `FITTIING ROOMS 5TH FLOOR` and
`LADIES LINGERE` are what the export says, and quietly correcting data we were given would make
the filter disagree with the roster.

## Finding who can cover a time

The question you actually ask while building a rota is not "where is Naima", it is "who can
cover 14:00". So the pool is **ordered by start time** by default (then end time, then name),
and an **On at** picker narrows it to the people on at one half hour of the day. A shift that
ends exactly at 14:00 does not count as on at 14:00 — that person is walking out of the door —
and an overnight shift is clipped to the close of the window, the same way its block is drawn.
The picker only offers the half hours the sheet itself is drawn on, so there is no way to ask
about a time the rota cannot show.

**Sort by** also offers name and the roster's own order.

What persists and what doesn't is a deliberate split: a department is who you are and a sort is
a preference, so both are saved; a time is a question you are asking right now, so **On at**
resets on reload. Finding yesterday's 14:00 still applied would just be baffling.

The three narrowings stack, and the message for an empty pool names whichever one emptied it,
checked in the order they were applied — department, then time, then name — so "nobody left to
place is on at 07:00 in this department" is never confused with "everyone has been placed".

## Headcount

Each room carries an **On duty** strip beneath its positions, and the grid ends with a
**Total on duty** row: one cell per half hour, counting the placements that overlap that
slot, so somebody on 09:00–18:00 is counted in every slot they cover. A person finishing at
18:00 and another starting at 17:30 both count in the 17:30–18:00 slot and not in the ones
either side of their own shift. Zeros are greyed in a room's own strip and shown red in the
total, where they mean nobody at all is on.

## Printing

`@page` asks for A4 landscape — a 15.5-hour timeline does not fit the short edge.

**One fitting room per sheet**, and each room's rows share out the whole page. The rooms are
separated by `break-before: page` on every group but the first, so the last room keeps the
Total on duty row instead of pushing it onto a sheet of its own, and page one keeps its title.
The rows fill the paper because each group is a flex column with a `min-height` and
`flex: 1 1 auto` rows: spare height is handed to the rows, but a room with more positions than
fit keeps its natural height and simply runs on rather than being squashed or clipped. The two
min-heights (160mm for the first room, 169mm for the rest, which have no title above them)
leave enough slack inside an A4's 192mm that a printer set to wider margins than `@page` asks
for still puts one room on one sheet. On paper the name column also narrows to 104px with
smaller position text, which is what buys the timeline the extra width.

Four things a printed sheet needs that the screen does not:

- **Block fills and the shaded header rows are backgrounds**, and browsers drop those when
  printing unless `print-color-adjust: exact` is set, so the sheet came out as an empty frame.
  Screen greys are also too faint on paper, so `--border` and `--border-strong` are darkened
  inside the print block. `html` gets the white background too, not just `body` — the canvas
  takes its colour from `html` when `html` has one, so setting only `body` left the strip
  below the grid printed in the screen grey.
- **The half-hour gridlines have to be real elements**, not a `repeating-linear-gradient` on
  `.track`. The gradient looked right on screen and printed as *nothing*: 1px stripes at a
  fractional period are rasterised away, so every row came out of the printer blank white with
  only the ruler and the On duty strip to read a time against. `rota-app.js` emits one `<i
  class="gl">` per half hour instead, which is vector-drawn and survives. Measured on a real
  print PDF: 0 of the expected gridlines rendered before, all of them after.
- **A title**, because the day tabs are hidden in print and nothing else on the page said
  which day it was. A print-only line carries the day, its date and the 07:00–22:30 window.
- **The hour scale on every page.** Each room is a page of its own, and only the first page
  would have carried the scale at the top —
  leaving later pages as rows of blocks with no way to read a time off them. Each room
  repeats the scale, on paper only, **directly under its own header**. Emitting it above the
  header instead put it between the previous room's On duty numbers and this room's name —
  two rows of small figures back to back, reading as though the scale belonged to the room
  above. It is shaded and the rooms are spaced apart so each one reads as a unit.

Every room header also carries the day and date on paper, so a page that gets separated from
page one still says which day it is for.

A row holding one person lets that person's block fill the row top to bottom, so it reads as a
box you can write beside rather than a thin bar floating at the top of a tall empty cell. Rows
with stacked lanes keep the lane geometry they have on screen, or the blocks would collide.

The lane height a row needs is written as **`min-height`, not `height`**. That is what lets the
print rules hand a row extra space without breaking it: the lanes set the floor and the row is
free to grow. A fixed height was overridden by the flex sizing, the lanes are positioned
absolutely against it, and ten people on one position printed as three — the other seven spilled
invisibly into the row below. Past eight deep the lanes stop growing the row and share a fixed
budget instead (`.track.dense` trims the block text to suit), because ten lanes at the screen's
44px is taller than an A4.

Rooms may break across sheets; rows may not. Keeping a room whole only mattered when several
shared a page, and a room too tall to fit would otherwise be pushed off, leaving the sheet
before it blank. **Known limit:** a room that does overflow continues on a sheet carrying
neither its name nor the hour scale — repeating those needs the grid rebuilt as a `<table>` with
a `<thead>`, which is the only reliable way to repeat a header in print. It takes roughly
eighteen people in one room to hit that.

Note when testing this: do **not** call `page.emulateMedia({media:"screen"})` before
`page.pdf()`. `page.pdf()` already renders with print CSS, and forcing screen media made a
run come out screen-styled — buttons and all — which looked like a pagination bug in the app
and was not.

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
