# FitTrack tests

No build step and no dependencies to install beyond Playwright's Chromium, which this
container already has. Everything runs against `fittrack/index.html` directly.

```bash
cd fittrack/Tools/tests
./run.sh                # all suites
./run.sh decoder camera # just those
```

A suite counts as passing only if it *says* so. A crashed suite prints neither "PASS" nor
"FAIL", so `run.sh` treats a missing summary as a failure — an earlier version reported
"ok" for eleven suites that were all erroring out on a module-type mismatch.

`package.json` here sets `type: commonjs` because the repo root sets `type: module` for the
Capacitor build, which would otherwise make every `.js` file an ES module.

Screenshots land in `$FITTRACK_OUT` (a temp dir by default).

## The suites

| Suite | Runs in | What it covers |
| --- | --- | --- |
| `decoder` | node | EAN-13/EAN-8/UPC-A round trips, blur, noise, low contrast, tilt, scale, upside down; adversarial noise and corrupted barcodes |
| `realframe` | node | Realistic camera scenes — label in a cluttered frame, lighting gradient, glare — through both the current and the old global-threshold binariser, so the fix stays justified |
| `stress` | node | 10,000 noise lines and 4,000 structured patterns must yield zero reads; frame-size and tilt limits |
| `camera` | browser | The whole camera path, with `canvas.captureStream()` standing in for `getUserMedia`: repeat scans, rotated barcodes, backing out mid-start, busy-camera recovery, no leaked streams |
| `scan` | browser | Barcode → food: library hit, online lookup, kJ conversion, unknown codes, offline, typed codes, UPC-A normalising |
| `search` | browser | Food search across saved foods, bundled basics and Open Food Facts; debounce, caret handling, offline and failure paths |
| `flow` | browser | Core logging: food entries, servings, editing, day navigation, workouts, unit conversion, persistence across reload |
| `plan` | browser | Weekly plan, schedule migration for older saves, today's plan on the home screen, no dangling routine ids |
| `own` | browser | Building your own routine from the ready-made screen and from the day planner |
| `presets` | browser | The 68-routine library: rendering, search by name and by exercise, notes carried into copies, 10×10 expanding correctly |
| `history` | browser | Last-session weights carried into a routine, personal bests, per-exercise history, never overwriting a typed value |

## Writing more

Two habits worth keeping, both learned the hard way here:

- **Select by name, not by index.** A test that clicked `PRESETS[11]` silently changed
  meaning when the library was reordered.
- **Make the test fail against the old code before trusting it.** The realistic-frame suite
  earns its keep because the previous binariser scores 16/36 on it. The camera suite is
  honest about the opposite: Chromium does not reproduce the iOS camera re-acquire failure,
  so that fix rests on documented behaviour rather than a reproduction.
