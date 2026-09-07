# Where I am Today — feature backlog

Everything worth adding to the fitting-room rota, written down so it can be picked from later
instead of decided on the spot. Ordered by how much the owner would actually use each one, not
by how interesting it is to build.

**Effort** — Small is an evening. Medium touches the state shape or the print layout and needs
testing on a real print. Big or risky changes something load-bearing, and wants a way back.
**Free data** marks the ones that need no new input at all: the roster PDF already gives us
breaks, departments, exact hours and every name.

**Done so far:** F11, F12.

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

### F3 · Say how much cover a room needs — Medium
Set a minimum per room and time band ("2 people, 12:00–17:00") and let the On duty strip go red
where you're under it. The strip shows numbers but never raises its voice.

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

### F10 · Suggest a fill — Big or risky
One button that puts a plausible person on every empty row, for you to correct rather than start
from blank. Should land as an obviously provisional state you have to accept, or a bad suggestion
gets printed unchecked.

### F11 · Filter the pool by department — DONE
The parser already read this and the app already stored it, then never used it.

### F12 · Find the person who's free at 14:00 — DONE
Sort the pool by start time, or filter it to "on at" a time you pick.

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

### F21 · Repeat the room header on a continuation sheet — Big or risky
A known limit: roughly eighteen people in one room overflows an A4, and the continuation page has
no name and no times. The honest fix is rebuilding the grid as a `<table>` with a `<thead>`, the
only way a browser reliably repeats a header in print — real regression risk to the drag-and-drop
and the ruler alignment.

### F22 · Stamp the printout — Small
"Printed 09:14, Sunday 30/08" in the corner. Two versions of the same day end up on the same wall.

---

## Keep the work safe

Everything built lives in one browser's storage on one machine.

### F23 · Save a day, or a week, to a file — Small
Export and import a small `.json`. A backup against a cleared cache, and how the day travels: open
the file from the USB stick on a different PC today and the work simply isn't there. For a tool
whose whole point is running from a stick, this is the missing half.

### F24 · Say when it last saved — Small
A quiet "saved 14:02", and a restore point from before the last import. Storage can also fail
silently when it's full.

### F25 · Warn before an import replaces a built rota — Small
Uploading the wrong week's export is a one-click mistake with a rebuild-from-memory recovery.

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
