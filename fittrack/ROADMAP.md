# FitTrack — what it takes to compete

An honest account of where FitTrack sits against MyFitnessPal, Strong and MacroFactor: what
to build next, what a web app on an iPhone genuinely cannot do, and which of those limits
actually matter.

Scope: **stays a PWA.** No App Store, no native build. Target is iOS 17+, added to the Home
Screen.

---

## Where we are

FitTrack is roughly one good app already: 68 routines, 165 bundled foods, ~200 tests
passing, 148 KB for the whole thing, no accounts and no cost.

**What is genuinely good**

- **It is fast and it is yours.** No login, no ads, no upsell, no network round-trip to log
  a banana. Every competitor below fails at least two of those.
- **Nutrition and training in one app.** MyFitnessPal owns food, Strong and Hevy own
  lifting, and they do not talk to each other.
- **The barcode scanner is strict about misreads** — checksum, geometry constraints, and two
  independent reads before it accepts a code.
- **Progression actually works.** Starting a routine fills in what you lifted last time,
  which is why 5×5 here is usable rather than a spreadsheet.

**What is visibly missing**

- **No recipes.** Every cooked meal is entered as separate ingredients, every time. Biggest
  daily-friction gap.
- **No copy or repeat.** No "same as yesterday", no recent-foods shortcut.
- **One serving size.** Everything is per 100 g; real logging is "two slices", "one tin".
- **Calories only.** Fibre, sugar, saturated fat and sodium all arrive from Open Food Facts
  and are thrown away.
- **No rest timer, plate maths, 1RM or volume charts** — the standard furniture of a lifting
  app.
- **No backup that happens by itself.** See the risk section; it is the one gap that can
  cost everything.

## The field

| App | Wins on | Costs | What we take from it |
| --- | --- | --- | --- |
| **MyFitnessPal** | Millions of products, recipe import, everyone's friends are on it | Ads, barcode paywalled, slow | Recipes and meal-level reuse. Not database size — unwinnable and not worth having. |
| **Cronometer** | Micronutrient accuracy from a curated database | Fussy logging, paywalled charts | Track the extra nutrients we already receive, without claiming lab accuracy. |
| **Strong / Hevy** | Best lifting loggers: rest timers, plate calculators, supersets, RPE, 1RM, per-muscle volume | No nutrition at all, subscription | Almost the whole training list. Our widest and most fixable gap. |
| **MacroFactor** | Infers real expenditure from weight trend vs. intake and adjusts weekly | Subscription only | The adaptive target — arithmetic over data we already store, and the single most valuable feature here. |

**Positioning.** We lose a database-size contest and a social contest. We win on speed,
privacy, no subscription, and food plus training in one place — and we can win outright on
adaptive targets, because that is maths, not infrastructure.

## What a PWA can and cannot do on iPhone

### Available to us

| Capability | Status | Detail |
| --- | --- | --- |
| Camera | shipping | Already used for barcodes; also unlocks progress and meal photos. |
| Push notifications | available | iOS 16.4+, **only** for a Home-Screen-installed app, only after an explicit allow. Enough for reminders. |
| App icon badge | available | `navigator.setAppBadge()` on an installed web app. |
| Keep screen awake | available | Screen Wake Lock, Safari 16.4+. Needed for rest timers and run tracking. |
| Large local storage | available | IndexedDB, hundreds of MB. localStorage caps near 5 MB — that ceiling is close once photos exist. |
| GPS location | constrained | Works **only while the app is open and on screen**. |
| Share / import files | constrained | `navigator.share` works; receiving a share *into* the app does not on iOS. |

### Closed to us

| Capability | Status | Why |
| --- | --- | --- |
| Apple Health | impossible | No web API for HealthKit, in either direction. Manual file import is the ceiling. |
| Apple Watch | impossible | Native builds only. |
| Home-screen widgets | impossible | Native builds only; the app badge is the nearest equivalent. |
| Step counting | impossible | Motion sensors report only while the app is open. |
| Heart-rate straps | impossible | Safari does not implement Web Bluetooth, deliberately. |
| Background anything | impossible | No background sync, location or periodic wake-ups. |

Two things follow. **Most of the roadmap is unaffected** — recipes, portions, timers, charts
and adaptive targets need no capability we lack. And the real cost of staying a PWA is
**Apple Health and the Watch**; if either becomes important, that is when to revisit the
native question, not before.

## The gap that can cost you everything

Every byte lives in one browser store on one phone. No server, no account. **Clearing
Safari's website data, deleting the app from the Home Screen, or losing the phone erases a
year of logs with no recovery.** Export is manual and relies on you remembering.

No competitor has this problem, because they all have accounts. It is the direct cost of the
privacy and speed we get in exchange — worth paying, not worth ignoring.

1. **Nag, and make it one tap.** Track the last export date; after a fortnight, offer a
   one-tap backup to Files or iCloud Drive. Cheap, removes most of the risk.
2. **Automatic file backup.** A dated JSON snapshot on a schedule to the same place.
3. **Real sync.** Needs a server, which means an account, a bill and a privacy story. Only
   worth it on a second device; if it happens, encrypt on the phone.

Recommendation: the first, now. Leave the third alone until a second device exists.

## The plan

Sizes: **S** an afternoon, **M** a day or two, **L** a week of evenings.

### Now — quick wins, biggest ratio

| Feature | Size | Why |
| --- | --- | --- |
| Recent & frequent foods | S | Data already exists in `uses` / `lastUsed`; purely a screen. |
| Copy a day or a meal | S | Most people eat the same handful of meals. |
| Real portion sizes | M | Per piece, slice, tin, cup. The serving maths already scales. |
| Quick-add calories | S | For the restaurant meal you will never find. Rough beats unlogged. |
| Rest timer | M | Starts when you tick a set; needs Wake Lock. |
| Plate calculator | S | "60 kg" → what to put on the bar. |
| 1RM estimate & volume charts | S | Epley over data we hold. Records screen is the home. |
| Weight trend line | S | Smoothed average over raw dots; daily weight is mostly noise. |
| Backup nagging | S | Cheapest risk reduction available. |
| Fibre, sugar, sat fat, salt | M | Open Food Facts already sends these. Optional, off by default. |

### Next — substantial, changes how it feels

| Feature | Size | Why |
| --- | --- | --- |
| Recipes | L | Build a dish once, log it as one item forever. Largest food-side gap. |
| **Adaptive calorie target** | M | Weight trend vs. intake → real expenditure → weekly goal. MacroFactor's whole premise, and it is arithmetic. **Most valuable item here.** |
| Move to IndexedDB | M | localStorage caps near 5 MB and is synchronous. Do it before photos. |
| Body measurements | S | Waist, chest, arms. The weight screen generalises. |
| Progress photos | M | Camera works; needs IndexedDB first; never leaves the phone. |
| Per-set rep schemes | M | Today one rep count per exercise, so 5/3/1 lives in the notes. |
| Automatic progression | M | All sets hit → add 2.5 kg. Three misses → drop 10%. That is what 5×5 *is*. |
| Weekly review | M | Intake, weight change, sessions, volume by muscle group. |
| Reminders | M | Web Push. Home-Screen install only — state that in the UI. |
| Water tracking | S | Small, and widely wanted. |

### Later — ambitious, only if it stays fun

| Feature | Size | Why |
| --- | --- | --- |
| Multi-week programmes | L | A routine that knows it is in week three. |
| Exercise library | L | Muscles, cues, substitutions. Feeds volume-by-muscle charts. |
| Run tracking | L | GPS works only with the screen on and app in front. Be honest or do not ship. |
| Import from other apps | M | MFP and Strong export CSV. Removes the "I'd lose my history" objection. |
| Encrypted sync | L | Only once a second device exists. |
| Split the source file | M | 148 KB is near the limit of comfortable editing — but costs the no-build-step property. |

### Not doing — decided, not deferred

| Feature | Verdict | Reason |
| --- | --- | --- |
| Apple Health sync | impossible | No web API. |
| Watch app, widgets | impossible | Native only. |
| Automatic step counting | impossible | No background sensors. |
| Heart-rate straps | impossible | No Web Bluetooth in Safari. |
| Social feed | declined | Would mean accounts and moderation; the opposite of why this is pleasant. |
| Photo food recognition | declined | Needs a paid vision API and is wrong often enough to erode trust. |
| Cloning the food database | impossible | The dump is gigabytes. Bundled basics + online lookup is the right shape. |

## Order of work

1. **Stop the typing.** Recent foods, copy a meal, quick-add, real portions. Cuts daily
   logging effort roughly in half; no architecture change.
2. **Finish the gym side.** Rest timer, plate calculator, 1RM and volume charts. Brings
   training level with Strong.
3. **Protect the data.** Backup nagging, then IndexedDB. Unglamorous, and the one place
   where delay has a cost that cannot be undone.
4. **The thing nobody else gives away.** Recipes, then the adaptive calorie target — the one
   feature where a free local app can be straightforwardly better than a paid one.

---

Capability claims reflect iOS 16.4 and later; re-check against your iOS version before
building on any single one of them.
