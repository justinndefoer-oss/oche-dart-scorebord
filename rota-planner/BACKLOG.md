# Where I am Today — feature backlog

Everything worth adding to the fitting-room rota, written down so it can be picked from later
instead of decided on the spot. Ordered by how much the owner would actually use each one, not
by how interesting it is to build.

**Effort** — Small is an evening. Medium touches the state shape or the print layout and needs
testing on a real print. Big or risky changes something load-bearing, and wants a way back.
**Free data** marks the ones that need no new input at all: the roster PDF already gives us
breaks, departments, exact hours and every name.

**Done so far:** F3, F10, F11, F12, F21, F22, F23, F24, F25. **Keep this file updated as each one lands** — mark it DONE with
what actually shipped, and update the count above. It is the handover, so a stale one is worse
than none. The same list is published as a page for reading on a phone; update both together.

---

## Make the sheet true

The rota is only worth printing if it matches what happens on the floor. These are the places
where it currently doesn't.

### F1 · Breaks on a block — Small, free data
A draggable 30 or 60 minute notch inside a person's block, with the On duty count dropping while
they're away. Right now a 09:00–18:00 block claims nine unbroken hours on one position, which is
never true. The roster already proves it: the Totaal column deducts between 0 and 60 minutes per
shift, which is exactly how the import checker validates a parse. A room showing two people
covered at 13:00 when both are actually on break is the failure you cannot currently see.

### F2 · Split a shift across positions — Medium
Cut one person's block at a time you choose and drag the second half to a different row — same
person, same rostered hours, two positions. Nobody should stand on Check in out for nine hours,
and today the only way to rotate someone is to remember it in your head.

### F3 · Say how much cover a room needs — DONE, merged 7 Sep
A **Cover** button per room sets minimum-cover rules by time band; half hours below the minimum
turn red in that room's On duty strip, and the room ends with a line stating the rule and how many
half hours are short. Overlapping bands take the highest minimum. The rule prints alongside the
red cells, because a red cell says something is wrong without saying what would fix it.

### F4 · Who haven't I placed? — Small, free data
A line at the top of the day: *14 people rostered today · 9 placed · 5 not on the sheet*, and a
click to see the five. Someone rostered who never gets dropped onto a row simply doesn't appear
anywhere, and nothing says so.

### F5 · Rooms that don't open at 07:00 — Small
Give each room its own opening window and grey out the hours it's shut.

### F6 · Be honest about overnight shifts — Small, free data
Mark a block that runs past the end of the day. A 21:00–06:00 shift is drawn as though it stops
dead at 22:30; the clipping is correct for the window but nothing tells the reader it happened.

### F7 · A note line per position — Small
One free-text line under a row's name. Exceptions currently get written on the printout in biro
and lost.

---

## Build the day faster

Placing people by hand out of a pool of 292 names, every day, from nothing.

### F8 · Copy a day's layout to another day — Small
Same rooms, same positions, same people where their hours allow it, skipped where they don't.

### F9 · Saved layouts — Medium
Name a room-and-position arrangement ("Standard Saturday", "Sale week") and drop it onto any day.

### F10 · Suggest a fill — DONE, merged 7 Sep
Built tighter than this entry described, because the owner specified it better: **Auto-fill day**
fills each room from **its own department only** (guessed from the room name, changeable in Setup)
and stops at the **minimum from F3** rather than filling every empty row. Greedy set cover — take
whoever closes the most half hours still short. It never places someone who only overfills, says by
name where a department ran out, adds to existing placements rather than replacing them, and the
whole run is one **Undo auto-fill**.

### F11 · Filter the pool by department — DONE, merged 31 Aug
A **Department** picker beside the name search, listing every department rostered that day with
the number left to place. Ten of the 33 names arrive clipped by the export itself; the cost centre
is dropped and a name that lost letters keeps an ellipsis rather than pretending to be whole.

### F12 · Find the person who's free at 14:00 — DONE, merged 2 Sep
The pool is ordered by **start time** by default, with an **On at** picker for any half hour of the
day and a **Sort by** for name or the roster's own order. A shift ending exactly at 14:00 does not
count as on at 14:00.

### F13 · Place several people at once — Medium
Tick three names, tap a row, all three land on it. Four people on one position at identical hours
is a real pattern.

### F14 · Undo — Medium
Deleting a room clears every placement on it. That is right, and terrifying without a way back.
Becomes urgent the moment F9 or F10 exists.

### F15 · Place from the keyboard — Medium
Click a row, start typing a name, press Enter.

---

## What comes off the printer

The printout is the product. The screen is just where it gets made.

### F16 · The per-person sheet — Medium, free data
A second print, alphabetical by name rather than by position: *El Mourabet, Naima — 1st Floor,
Check in out, 08:00–14:00*. Everything today is position-first; nobody on the floor thinks that
way. Same data, transposed, and the app finally answers the question it's named after.

### F17 · Choose which rooms print — Small
One room per sheet means five sheets whether or not the 5th floor is open today.

### F18 · A blank sheet — Small
Print the grid with nobody on it, for the days the PDF hasn't arrived.

### F19 · Export the day to Excel — Medium
The example the owner first showed was a spreadsheet, so somebody upstream still works that way.

### F20 · Short names in narrow blocks — Small
Confirmed on a real print: "Perera, Wickramasingh Arach" cut off mid-word in a 21:00–22:30 slot.
Fall back to surname, then surname plus initial.

### F21 · Repeat the room header on a continuation sheet — DONE, merged 7 Sep
Solved by choosing the break instead of rebuilding the grid as a table: `chunksFor` adds up the row
heights against what a sheet holds and splits an oversized room into pieces, each with its own
heading, hour scale, On duty strip and cover note, headed *(sheet 2 of 3)*. Screen is untouched —
the continuation chrome is print-only, so a room still reads as one list of rows.

### F22 · Stamp the printout — DONE, merged 7 Sep
Every room header carries the day, date and the time it was printed, so it is on every sheet rather
than only the first. Written at render and rewritten on `beforeprint`, or a page left open would
print the time it was opened.

---

## Keep the work safe

Everything built lives in one browser's storage on one machine.

### F23 · Save a day, or a week, to a file — DONE, merged 7 Sep
**Save to file** and **Open file** in the header, writing the whole state as a ~73 KB `.json` named
for the week. The roster travels inside the file, so it opens on a PC that never saw the PDF. A bad
file is refused whole and says which check it failed.

### F24 · Say when it last saved — DONE, merged 7 Sep
A quiet **saved 14:02** in the header, turning red and naming the fix when storage is full or
blocked — it used to fail silently. Plus a restore point taken before each import, offered as
**Undo this import**.

### F25 · Warn before an import replaces a built rota — DONE, merged 7 Sep
Asks before the picker opens, and only when there are placements to lose. The wording says what
actually happens: a placement survives only where that person still works the same day at the same
hours. Afterwards the banner says how many did not survive, with the undo beside it.

---

## When the roster changes

The import check catches a bad parse. None of it catches a roster that moved underneath you.

### F26 · Compare against last week — Medium
Who's new, who's gone, whose hours changed. The current check reconciles a parse against the PDF's
own arithmetic — it verifies we read the file correctly, not that the file says what you expect.

### F27 · Re-import mid-week without losing the rota — Medium
Keep every placement whose person and hours still match, list the ones that no longer do.

### F28 · Cope with a different export layout — Big or risky
If the day columns can't be found, show the raw table and let the user point at which column is
which. The parser locates columns structurally between "Naam" and "Totaal", which is why it
survives small changes; a redesigned export kills it outright. Insurance, not a feature.

---

## Deliberately not doing

Written down so they don't get rediscovered and talked into every few weeks.

| | |
|---|---|
| **Accounts and syncing** | The reason this works at the owner's job is that it's one file that opens offline with nothing behind it. A login is the fastest way to make it stop working. |
| **Printing a whole week** | Seven days across five rooms is thirty-five sheets. Nobody reads sheet twenty. |
| **A phone-first rebuild** | It already works on a phone for checking and small fixes. Building a whole day on a 393px screen isn't a thing anyone wants to do. |
| **Editing someone's hours** | Fixed hours are the rule the tool is built around — the drop position is never even read. `+ Add person` exists for the genuine gaps. Loosening this makes every other guarantee meaningless. |
