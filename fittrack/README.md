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
