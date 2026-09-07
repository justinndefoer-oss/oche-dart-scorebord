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

## Saving a rota to a file

Placements live in `localStorage`, which is one browser on one machine — so without this the
day cannot travel, and a cleared cache loses an afternoon. **Save to file** writes the whole
state (roster, rooms, positions, every placement, the filters) as a small `.json` named for the
week, e.g. `where-i-am-today-2026-08-30.json`; **Open file** loads it back. About 73 KB for a
292-person week.

The roster travels with it deliberately: the PC you open the file on may never have seen the
PDF. That also means the file contains every colleague's name and hours, so it deserves the
same care as the roster export itself.

Opening replaces everything on screen, so it asks first — but only when there is something to
lose, since nagging about an empty rota is just noise. A file is refused whole rather than
loaded half-way: it must carry the `where-i-am-today-rota` marker, a version no newer than the
app understands, and a roster with employees and day labels. Each failure says which check it
was, because "couldn't open that file" on its own tells you nothing about what to do next.

On load the id counters are re-derived from the file's own ids. Without that the next room or
row added would collide with one already in it.

Note for the download: the object URL is revoked on a timer, not immediately — revoking it in
the same tick cancels the download in some browsers.

## Knowing the work is safe

Saving used to swallow its own failure — a full or blocked `localStorage` looked exactly like a
working one until you reloaded and found the day gone. `saveState` now reports, and the header
carries a quiet **saved 14:02**. When it can't save it says so loudly, in red, and names the way
out: *"Not saving — this browser's storage is full. Use Save to file."*

Loading a new roster asks first, but only when there are placements to lose. The wording says what
actually happens rather than "this replaces everything": placements are matched on person, day and
hours, so **a placement survives only where that person still works the same day at the same
hours**, and anything else is dropped by `pruneStaleAssignments`.

After an import the banner says what it cost — *"3 of your 43 placements did not survive"*, or that
all of them did — and carries **Undo this import**. The state from before the import is stashed
under its own key, `…-before-import`: it has to survive the write that replaces the live state, and
it must not end up inside a saved `.json`. It is stashed only when there is something to lose,
consumed when used, and a failure to stash never blocks the import — no undo point is better than
no import.

## Reset

"Clear the rota" means three different things and getting the wrong one back is a rebuilt week, so
**Reset** opens a panel that spells them out with their counts rather than hiding them behind one
confirm:

- **Clear <day>** — that day's placements only.
- **Clear every day** — all placements, keeping the roster, the rooms and the cover rules.
- **Start over** — drops the roster too and puts rooms and positions back to the defaults. The
  only one that asks, because the roster took a PDF and a check to get in.

Each stashes an undo point first, so **Undo** in the banner afterwards puts it straight back —
including the roster after Start over. The two clear buttons disable themselves at zero, so the
panel never offers to clear nothing.

Note the label on Start over says *rooms back to the defaults*, not *no rooms*:
`ensureDefaultPositions` re-seeds the default five on an empty state, and the shorter phrasing
would have been a lie.

## Headcount

Each room carries an **On duty** strip beneath its positions, and the grid ends with a
**Total on duty** row: one cell per half hour, counting the placements that overlap that
slot, so somebody on 09:00–18:00 is counted in every slot they cover. A person finishing at
18:00 and another starting at 17:30 both count in the 17:30–18:00 slot and not in the ones
either side of their own shift. Zeros are greyed in a room's own strip and shown red in the
total, where they mean nobody at all is on.

## How much cover a room needs

Each room can say how many people it needs **in every half hour**, typed straight into a
**Needed** strip that sits directly above that room's On duty strip and shares its columns
exactly — what you want over what you have. Open it from the **Minimum** button in the room
header, or from the summary line.

It began as a list of from/to bands, which meant translating "we need three over lunch" into an
abstraction before you could type it. The strip is the same shape as the answer. Consecutive half
hours wanting the same number are folded back into bands for the summary line, so it still reads
as *Needs 2 from 09:00 to 18:00, 1 from 18:00 to 22:30* — 31 numbers is how you edit it, a
sentence is how you read it. Past three runs the sentence gives up and says the range instead,
because the strip says it better.

**Set every half hour to** fills the row in one go, and **Clear all** empties it. Old band-shaped
saves are expanded into the strip on read; the band form is never written again.

Typing does not re-render — a full render would rebuild the inputs and throw away the caret
mid-number. The model is updated in place and only what depends on it is repainted: the red On
duty cells and the summary line. That is also why the toggle is a delegated click rather than a
listener bound per element: the summary line is one of the things that opens the panel, and it is
replaced on every keystroke. Half hours below the minimum turn red in that room's On duty
strip, and the room ends with a line saying the rule in words and how many half hours are short.

**That line is the way in, not just a readout.** On screen it is a button, because it is where you
are already looking when you decide the rule is wrong. A room with *no* minimum shows the line too
— *"No minimum set for this room · Set one"* — where before it showed nothing at all, so there was
no hint the setting existed unless you already knew it lived behind a button in the header. The
button was called Cover, then Setup, and the owner still had to ask where minimums were set; the
always-visible line is the actual fix, and the rename to Minimum is the smaller half of it.

Both are screen-only. `button.cover-note` is hidden in print, or the rule printed twice (once as
the button, once as the plain line beside it) and a room with no minimum printed *"No minimum set
for this room"*, which is not a rota's business.

Details that matter:

- **No rule is not the same as needing nobody.** A room without rules is never marked short.
- **Overlapping bands take the highest minimum.** Two rules covering one moment both have to be
  satisfied, so the larger one is the real requirement.
- **A band that would end before it starts is nudged, not ignored.** Setting `from` past `to`
  silently matches no slots at all, which looks like the rule was dropped; the other end moves
  along by half an hour instead.
- **The rule is printed, not just the red cells.** A red cell says something is wrong without
  saying what would fix it, so the note goes on paper (the editor doesn't) and every cell carries
  the shortfall in its tooltip on screen.
- Red alone would be lost on a mono printer, so an under-cover cell also gets a heavy underline.

Two layout traps, both the same one already hit with the room controls: the note and the editor
live inside the grid, which is at least 1180px wide and scrolls sideways, so both are capped to
the viewport or the delete cross ends up somewhere you have to scroll to find. And
`.cover-editor[hidden]` needs an explicit `display:none`, because the author `display:flex` beats
the browser's own `[hidden]` rule and the panel starts open otherwise.

## Auto-fill

**Auto-fill day** fills every room from its own department, up to the minimum that room was told
to need, and no further.

Each room has a **Staff from** department, set in the same Minimum panel. It is guessed from the room's
name the first time — but on words rather than on the whole string, because the names describe the
same floors differently: *Fitting Room 1st Floor* against `FITTING ROOMS 1ST FLOOR(33`. Two words
count as the same when one is a prefix of the other, which carries the departments the export
clipped (`grou` for `ground`), and the match is *scored* rather than required in full, which is
what survives the export's own typo, `FITTIING ROOMS 5TH FLOOR`. On the sample roster all five
rooms match correctly. A guess is never written to the save; choosing one is, and "Any department"
is a real choice rather than a fallback to the guess.

The fill is greedy set cover: it repeatedly takes whoever closes **the most half hours that are
still short**, tie-breaking on the fewest hours wasted outside the gap. Taking people in start
order instead leaves the middle of the day thin and then has nobody left for it.

Three properties this gives, in the order they matter:

- **It never places someone who only overfills.** A candidate is taken only if they cover a half
  hour that is currently below the minimum, so the fill stops at the target rather than emptying
  the pool onto the rota. Running it twice places nobody the second time.
- **It cannot underfill silently.** Where the department has nobody left, the report says so by
  name and the red cells stay.
- **It adds, it does not replace.** Hand-place the people who have to be somewhere specific, then
  fill the rest. Existing placements are counted as cover already met.

Some overshoot is unavoidable and not a bug: a person is a block of hours, so covering a gap at
13:00 may also add to a 15:00 that was already satisfied. Greedy set cover is also not optimal —
it can use one more person than the perfect answer would.

A room is skipped, and told to you, when it has no positions, no minimum, or no department. And
the whole fill is one undo: **Undo auto-fill** in the report puts the rota back exactly as it was.

When a room ends up short, the report distinguishes **"nobody from that department works this
day"** from **"everyone from that department is already placed"**. They are different problems — a
minimum set on the wrong room versus a rota that cannot be filled — and the first phrasing used to
cover both, which read as though people had been used up when there had never been any.

### What the stress run showed

Random minimums of 1–3 per room, auto-filled across all seven days, twice (a full 07:00–22:30
window and a 09:00–20:00 one). Every safety property held: **no placement in the wrong department,
nobody placed twice, nobody placed outside their own hours, never more than two on one row, no
page errors, and a second run always places nobody.** Crucially, **not one usable person was left
behind** — after each fill there was nobody remaining in a room's department who could still have
closed a short half hour, so the algorithm never quits early.

What it also showed is that a full-day minimum is a much bigger ask than it looks, and this is
arithmetic rather than a fault in the fill: a shift is about eight hours and the window is 15.5, so
holding a minimum of *n* across the whole day needs roughly **2n people rostered in that
department**. Minimums of 2–3 across 07:00–22:30 left most rooms short simply because 0–2 people
from those departments were rostered on any given day. Narrow the band or lower the number.

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

Every room header also carries the day, the date and **the time it was printed**, so a page that
gets separated from page one still says which day it is for and which of two versions on the wall
is the newer. The stamp is written at render and rewritten on `beforeprint`, because a page left
open for an hour would otherwise print the time it was opened.

**A room too tall for one sheet is split here, not by the browser.** Left to it, the break lands
wherever the paper runs out and the next sheet arrives with no room name and no hour scale — rows
of blocks with no way to read a time off them. So the split is chosen in `chunksFor`, which adds
up each row's lane-driven height against what a sheet holds (`PRINT_ROWS_BUDGET`, and a smaller
`PRINT_ROWS_FIRST` for the room that shares its sheet with the title) and gives every piece its own
heading, scale, On duty strip and cover note. Headings say *(sheet 2 of 3)* so nobody thinks they
have the whole room. Both budgets are measured against real print PDFs rather than derived from
the stylesheet, and the check that matters is the one in the tests: no printed sheet may carry
rows without also carrying a room name and a scale.

The alternative was rebuilding the grid as a `<table>` so a `<thead>` repeats itself, which is the
only header repetition browsers do reliably. That means redoing the ruler alignment, the
absolutely-positioned blocks and the page-fill sizing — all of which took several rounds to get
right — so it was not worth it for a case that needs about fourteen positions in one room to reach.

Splitting is a paper concern only. On screen the continuation headings and the repeated On duty
strips are `print-only`, so a room still reads as one unbroken list of rows. Note the trap that
caught this: `.print-only` is a single class, so a component rule of equal specificity that sets
its own `display` (`.group-head`, `.row`, `.cover-note`) simply wins and the element appears on
screen anyway. Those need saying again, one class heavier.

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

**A department name too long for its column is handled two different ways by this export,
depending on the options it was run with.** The week 36 file CLIPS it — `FITTING ROOMS LOWER GROU`
— and those characters are simply gone. The week 37 file WRAPS it onto a second line instead:
`FITTING ROOMS LOWER` / `GROUND(202)`. Left alone the wrapped form produced a department called
`GROUND(202)` and lost the real name completely, which took out three of the four fitting rooms.

Two heading rows are treated as one wrapped name only when they are **immediately adjacent** —
9.7pt apart in the sample, against 11.5pt for a row of employees — and the first has **no closing
bracket**, since the cost centre ends a complete name. Any other row in between clears the
candidate, so a heading that merely follows a block of employees can never be glued to the one
before it. The clipped form is untouched: there is no second line to join, and nothing can recover
characters the export never wrote.

A room's saved department also heals itself. One saved as `FLOOR(110)` back when wrapped names
were split in two would otherwise keep filtering to a department nobody is in — placing nobody,
with the picker showing the wrong thing selected. A stored name that no longer exists falls back
to the guess.

If a future export doesn't match this structure, the day columns won't be found and the app
shows a warning — names can still be added by hand.
