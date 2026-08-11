# FitTrack

Offline calorie, workout and weight tracker for iPhone. Same shape as the OCHE dart
scoreboard: a single `index.html` (HTML + CSS + JS, no build step), a service worker for
offline use, and add-to-home-screen so it behaves like an app.

Lives at **`/fittrack/`** on the same GitHub Pages site as the scoreboard:
https://justinndefoer-oss.github.io/oche-dart-scorebord/fittrack/

## What it does

**Food** — log per meal (breakfast / lunch / dinner / snack) with calories and
protein/carbs/fat; save foods you eat often to a searchable library and pick from them;
day-by-day history you can page back through; per-meal and per-day totals against your
calorie goal.

**Workouts** — strength sessions (exercises → sets → reps/weight, with a done tick per set)
and cardio (duration, distance, calories burned). Save any session as a routine and start
from it later. History grouped by day, with a detail view.

**Ready-made routines** — 15 presets in five groups (full body A/B/C, push/pull/legs,
upper/lower, home & bodyweight, cardio). Picking one copies it into your own routines, so
you can edit it freely afterwards. Starting weights are 0 on purpose: the app cannot know
your loads, you fill them in the first time you run the session and they stick.

**Weekly plan** — assign routines to weekdays (more than one per day is fine, e.g. a lift
and a run). Today's plan appears on the Home screen with a Start button, and drops off that
card once you have logged a workout with the same name.

**Food search** — one search box across three sources: your own saved foods, ~165 bundled
generic foods (per 100 g, searchable in English or Dutch — "kip" finds chicken breast), and
Open Food Facts for packaged products when you are online. The bundled basics cover the
everyday things a product database is bad at — banana, rice, chicken breast — and work with
no connection at all.

**Barcode scanning** — point the camera at a grocery barcode (EAN-13, EAN-8 or UPC-A).
Codes resolve in three steps: your own saved foods first (instant, works offline), then
Open Food Facts over the network, and failing both you fill it in once and the barcode is
remembered against that food forever. There is also a field for typing the number when a
label is too crumpled to read.

**Weight** — log weigh-ins with an optional note; line chart over 30d / 90d / 1y / all,
with an optional goal line.

**Home** — calories eaten vs. goal as a ring, macro split and bars, quick-add buttons,
today's workouts, the last 7 days of calories as a bar chart, and the 30-day weight trend.

**Settings** — calorie goal, optional macro goals, goal weight, kg/lb, km/mi, and
JSON export/import.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The entire app — markup, styles and logic |
| `sw.js` | Service worker: network-first, cache fallback |
| `manifest.json` | PWA manifest (standalone, portrait) |
| `icon-180/192/512.png` | App icons |
| `Tools/make_icons.py` | Regenerates the icons — no image libraries needed |

## How the data is shaped

Everything is one JSON object in `localStorage` under **`fittrack-state`**:

```
{ v, settings, schedule{}, foods[], entries[], workouts[], routines[], weights[] }
```

`schedule` is keyed by JS `getDay()` (0 = Sunday … 6 = Saturday), each value an array of
routine ids. Deleting a routine strips its id from every day, and `load()` fills in the
seven keys for saves written before the planner existed.

Four decisions that matter if you extend it:

- **Food entries copy their nutrition.** An entry stores calories and macros *per serving*
  plus a serving count, and only keeps a `foodId` pointing back at the library. Editing or
  deleting a saved food never rewrites what you already logged — the flow tests cover this.
- **Every entry carries a `day` key** — `'YYYY-MM-DD'` in local time — which is what the
  browse-by-day screens and the daily totals group on. String comparison on that format
  sorts correctly, so date-range filters are plain `>=`.
- **Units are normalised at the edges.** Weights are stored in kilograms and distances in
  kilometres; kg/lb and km/mi are display preferences, converted when a form loads and
  again when it saves.
- **Forms edit a draft object,** not the stored record. Nothing is written until you tap
  Save, so Cancel costs nothing. Redrawing a sheet drops keyboard focus, so typing writes
  straight into the draft without a redraw — only structural changes (adding a set,
  switching type) redraw.

## Where the food data comes from

Three sources, deliberately, because no single one covers everything:

| Source | Covers | Offline? |
| --- | --- | --- |
| Your saved foods | whatever you have logged before | yes |
| Bundled basics (`BASICS_RAW`) | ~165 generic foods, per 100 g | yes |
| Open Food Facts | packaged products, by name or barcode | no |

A full product database **cannot** be bundled — Open Food Facts' own dump runs to several
gigabytes, far past what a page can ship or localStorage can hold. So packaged products
need a connection the first time, after which they land in your library and stop needing
one.

`BASICS_RAW` values are typical reference figures per 100 g, not measurements of the exact
brand in your kitchen; everything picked from it opens in an editable form. Each row carries
Dutch aliases used for searching only. Wine and spirits are the one place where calories
deliberately exceed what the macros explain — alcohol carries 7 kcal/g and is not protein,
carbohydrate or fat.

`OFF_HOST` is set to `nl.openfoodfacts.org`, which ranks Dutch products first and still
returns everything else; change that one constant for a different country bias. Name search
is debounced by 500ms and needs three characters, so typing does not fire a request per
keystroke.

## The barcode decoder

Safari has no `BarcodeDetector`, and the app ships no external libraries, so the decoding is
written out in `index.html`. Each camera frame is drawn to a 640px canvas, fourteen
horizontal scanlines across the aiming box are thresholded at their own midpoint, turned
into bar/space run lengths, and matched against the EAN digit patterns. Every digit is
normalised against its own seven modules, which is what lets a tilted barcode still read.
On Chrome/Android the native `BarcodeDetector` is used instead when present.

Three things guard against a misread logging the wrong food: the EAN checksum, a set of
width and quiet-zone constraints tuned in `BC`, and a rule that the same code must be read
twice before it is accepted.

Those `BC` constants were fitted, not guessed. `Tools/` has no test runner, but the suite
used during development encoded known barcodes, rendered them as scanlines with blur,
noise, low contrast, tilt and varying scale, and decoded them back; the constants are the
loosest values that still gave **zero** reads across 10,000 random-noise lines, 4,000
striped/gradient/text-like patterns, and 200 deliberately corrupted barcodes. Loosening
them buys a slightly faster scan and risks logging the wrong product — not a good trade.
A barcode filling roughly a third or more of the frame width decodes; below about a
quarter it aliases and will not.

Lookups go to `https://world.openfoodfacts.org/api/v2/product/<code>.json` and use the
per-100 g figures (falling back to converting kJ when a product carries no kcal). Products
are labelled "100 ml" instead when the packaging quantity looks like a liquid. Anything
found online is saved to your library automatically, so the second scan of the same product
never touches the network.

## Backups matter here

There is no account and no sync. Clearing Safari's website data, or deleting the app from
the Home Screen, erases everything. Settings → Export writes a JSON file you can keep;
Import restores it. Worth doing every so often.

## Two PWAs, one Pages site

The scoreboard's service worker is registered at the site root and its scope covers the
whole site; FitTrack registers its own at `/fittrack/`. The more specific scope wins for
pages beneath it, so FitTrack pages are controlled by FitTrack's worker and the two caches
(`oche-cache-v3` and `fittrack-cache-v1`) stay separate. Nothing about the scoreboard
changes.

## iOS notes

The iPhone standalone-mode fixes from the scoreboard are carried over here — status bar
style `default` (not `black-translucent`), `height:100%` rather than `100dvh`, a flex
column shell with nothing pinned by `position:fixed`, and `env(safe-area-inset-bottom)`
padding on the tab bar. See the root `CLAUDE.md` for why each one is the way it is; they
were expensive to find and should not be undone.

Camera access in a Home Screen web app needs iOS 14.3 or newer, and HTTPS — GitHub Pages
provides that. iOS may ask for camera permission again on each launch of a standalone web
app rather than remembering it; that is the platform, not the app. If the camera cannot
open, the scanner says so and offers the type-the-number field rather than showing a dead
black rectangle.

Installing: open the URL in Safari, Share → Add to Home Screen. If a stale version comes
up after an update, load it once with a cache-buster (`…/fittrack/?v=2`, incrementing each
time). The service worker is network-first, so an online launch normally picks up new
builds by itself.

## Testing changes

No build step, so open `index.html` directly in a browser. Before shipping:

1. Extract the `<script>` block and run `node --check` on it to catch syntax errors.
2. Drive it with Playwright + the preinstalled Chromium (viewport 393×852,
   `deviceScaleFactor:3`, `isMobile:true`, `hasTouch:true`) and screenshot the five tabs
   plus the sheets. Watch the console — a thrown error inside a render function leaves a
   blank screen.
3. Chromium will not reproduce the iOS standalone viewport quirks. Confirm those on the
   phone.
