# FitTrack

A personal calorie + fitness tracker for iPhone. Native SwiftUI, iOS 17+, SwiftData,
everything stored on-device. No backend, no login, no cloud sync, no App Store.

This lives alongside the OCHE dart scoreboard in the same repository but is a
completely separate app — it shares no code with `index.html`.

## What v1 does

**Nutrition**
- Log food per meal (breakfast / lunch / dinner / snack) with calories and protein/carbs/fat
- Save reusable "custom foods" so you only type the numbers once, and pick from them later
- Daily calorie goal with a progress ring and a remaining/over number
- Daily macro totals against optional macro goals, plus a calorie-split bar
- Day-by-day history you can page back through

**Workouts**
- Log strength sessions (exercises → sets → reps/weight) and cardio (duration/distance/calories)
- Reusable routines; "Start" copies a routine into a fresh editable session
- History grouped by day, with a detail view per workout

**Weight**
- Log body weight with an optional note
- Line chart over 30d / 90d / 1y / all, with an optional goal line

**Dashboard**
- Today's calories vs. goal, macros, quick-add buttons for food/workout/weight
- Today's workouts
- Last 7 days of calories as a bar chart, plus the 30-day weight trend

**Settings**
- Calorie goal, macro goals (toggleable), weight goal
- kg/lb and km/mi display units — data is always *stored* in kg and km

## Project layout

```
FitTrack/
├── FitTrack.xcodeproj/
├── Tools/generate_xcodeproj.py    # regenerates the project file from the source tree
└── FitTrack/
    ├── FitTrackApp.swift          # @main, model container, settings injection
    ├── Models/                    # SwiftData @Model types + schema/container setup
    │   ├── Enums.swift            # MealCategory, WorkoutType, unit enums
    │   ├── Food.swift             # reusable custom food
    │   ├── FoodEntry.swift        # one logged food
    │   ├── Workout.swift          # Workout / Exercise / ExerciseSet
    │   ├── WorkoutTemplate.swift  # WorkoutTemplate / TemplateExercise
    │   ├── WeightEntry.swift
    │   └── Persistence.swift      # schema, ModelContainer, preview sample data
    ├── Services/                  # the "view model" layer: pure logic, no SwiftUI
    │   ├── NutritionMath.swift    # totals, grouping, progress
    │   ├── TrendBuilder.swift     # chart series
    │   └── WorkoutDraft.swift     # editable value-type mirror of a workout
    ├── Support/                   # UserSettings, date helpers, number formatting
    └── Views/
        ├── RootView.swift         # the five tabs
        ├── Components/            # ring, macro bars, tiles, number fields
        ├── Dashboard/  Food/  Workouts/  Weight/  Settings/
```

### Data model notes

- **Food entries copy their nutrition.** A `FoodEntry` stores per-serving calories and
  macros plus a serving count, and only keeps a nullify-on-delete link back to the `Food`
  it came from. Editing or deleting a saved food therefore never rewrites your history.
- **Enums are stored as raw strings** (`mealRaw`, `typeRaw`) with a computed enum accessor.
  SwiftData can persist `Codable` enums, but they are awkward inside `#Predicate`.
- **Every entry carries a `dayKey`** — its date truncated to midnight — which is what the
  "browse by day" screens and daily totals group on.
- **Units are normalised at the edges.** Weights are stored in kilograms and distances in
  kilometres; conversion happens when loading into an editor and when saving.
- **Workouts are edited as value types** (`WorkoutDraft`), so a half-finished session never
  reaches the store and Cancel costs nothing.

## Opening and running it

1. **Open the project** — double-click `FitTrack/FitTrack.xcodeproj`, or from Terminal:
   ```
   open FitTrack/FitTrack.xcodeproj
   ```
   You need Xcode 15 or newer (iOS 17 SDK). Xcode 16/26 are fine too.

2. **Try it in the Simulator first** — pick any iPhone simulator in the toolbar and press
   ⌘R. Nothing needs signing for the Simulator, so this is the fastest way to confirm the
   build is healthy.

3. **Set your signing details** before running on the phone. Select the **FitTrack**
   project in the navigator → **FitTrack** target → **Signing & Capabilities**:
   - Tick **Automatically manage signing**
   - **Team**: your Apple ID. If the dropdown is empty, add your Apple ID under
     Xcode → Settings → Accounts (a free Apple ID works — you do *not* need the paid
     $99 Developer Program for personal use).
   - **Bundle Identifier**: change `com.example.FitTrack` to something unique to you,
     e.g. `com.justin.FitTrack`. Xcode will refuse to sign the placeholder.

4. **Run on your iPhone**
   - Plug the phone in (or use Wi-Fi if it's already paired), unlock it, tap Trust.
   - On the phone: Settings → Privacy & Security → **Developer Mode** → on, then reboot.
     (iOS 16+ requires this before it will launch a self-signed app.)
   - Pick your iPhone in Xcode's device menu and press ⌘R.
   - The first launch fails with "Untrusted Developer" — on the phone go to
     Settings → General → **VPN & Device Management**, tap your Apple ID, **Trust**.
     Then press ⌘R again.

5. **A note about free Apple IDs**: apps signed with a free account expire after **7 days**
   and stop launching. Rebuild from Xcode to reset the clock. A paid Developer Program
   account extends this to a year. Either way the data stays on the device between
   rebuilds as long as you don't delete the app.

## Extending it

Add new files in Xcode as normal — Xcode updates the project file itself. Only if you add
files from outside Xcode (copying a folder in, say) do you need:

```
cd FitTrack
python3 Tools/generate_xcodeproj.py
```

That rewrites `FitTrack.xcodeproj` from whatever is on disk. It is deterministic, so it
does not churn the file when nothing changed. Note that it regenerates build settings from
the script's constants — if you changed the bundle ID or team in Xcode, update the values
at the top of the script (or just re-set them in Xcode afterwards).

Things deliberately left out of v1, in rough order of how easy they'd be to add: HealthKit
sync, barcode scanning, reminders/notifications, per-exercise personal-record tracking,
CSV export, iCloud sync.
