# OCHE — Dart Scorebord

## What is in this repo

Unrelated apps, deployed from the same GitHub Pages site:

1. **OCHE dart scoreboard** — the root `index.html` / `sw.js` / `manifest.json`. Everything
   below in this file is about this app unless a section says otherwise.
2. **FitTrack** — `fittrack/`, an offline calorie/workout/weight PWA built the same way
   (single `index.html`, own `sw.js`, own scope at `/fittrack/`). See `fittrack/README.md`.
   It reuses the iOS standalone fixes documented here; do not "fix" them differently there.
3. **FitTrack (native)** — `FitTrack/`, a SwiftUI/SwiftData version of the same app. Written
   before the owner confirmed they have no Mac, so it has never been compiled. Left in the
   repo for later; not deployed and not part of the Pages site.
4. **Rota Planner** — `rota-planner/`, a standalone daily-rota builder (not a PWA, no service
   worker). Upload a "Node Weekrooster" PDF export and it parses names/days/hours client-side
   via a vendored `pdf.js`, then you drag people onto freeform position rows for a 07:00–22:30
   day. The owner's actual deliverable is `rota-planner/rota-planner.html`, a single
   self-contained file (pdf.js + worker + app all inlined) that runs offline from `file://`
   on a work PC — regenerate it with `node build-single-file.cjs` after editing any source
   file, or the two will drift. See `rota-planner/README.md`.

# The dart scoreboard

Offline iPhone dart-scoring PWA. **Single file: `index.html`** (HTML + CSS + JS, no build step).
Plus `sw.js` (service worker) for offline + auto-update. Design comes from the Claude Design
handoff in `project/` and `chats/`.

Hosted on GitHub Pages: https://justinndefoer-oss.github.io/oche-dart-scorebord/
The owner updates it by uploading `index.html` via the GitHub web UI.

## Architecture (index.html)
- One `STATE` object (players, setup, settings) persisted to `localStorage` (`oche-state`).
- Tab screens (`#screen-spel`, `#screen-modus`, `#screen-spelers`, `#screen-instellingen`)
  and `#game` live inside `.screens`; the tab bar is a sibling flex child below them.
- Game screen is regenerated per game type by `renderGameScreen()`.
- 6 game modes: x01, Cricket, Around the Clock, Killer, Shanghai, Bob's 27 — each with real
  scoring/bust/win logic. Dart Robot bot (3 levels) plays via weighted probability tables.
- Icons are an inline SVG set (`ICONS` map + `icon()` helper), Lucide style — NOT emoji.
  Emoji are the biggest "AI-generated" tell; keep using the SVG set.

## iOS standalone (add-to-home-screen) gotchas — HARD-WON
These cost many rounds; do NOT regress them:

1. **Status bar style MUST be `default`, NOT `black-translucent`.**
   `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
   With `black-translucent` the standalone viewport came up 62px short (screen 874 vs
   innerHeight 812), leaving a dark/uncovered strip BELOW the tab bar. `default` makes the
   web view fill correctly under an opaque status bar.

2. **Use `height: 100%` on html/body, NOT `100dvh`/`100vh`.**
   In this device's standalone mode `100dvh` resolved to 812 (too short); `height:100%`
   off `html{height:100%}` gives the true full height.

3. **Layout = flex column.** `#app{position:relative;height:100%;display:flex;flex-direction:column}`,
   `.screens{flex:1;min-height:0;overflow:hidden}`, tab bar `.tabbar{flex:none}` last.
   Do NOT pin the root or the tab bar with `position:fixed;inset:0`/`bottom:0` — in standalone
   that anchored to the short (812) viewport and floated the bar above the physical bottom.

4. The tab bar keeps `padding-bottom: env(safe-area-inset-bottom)` for the home-indicator
   clearance (~34px). That small space under the labels is CORRECT, not a bug.

### How to diagnose layout on-device (what worked)
Color `html`/`body` a bright color and `#app` dark: a colored strip = inside our layout (CSS
fixable); a strip in the PWA `theme-color` = outside the web view. Add a temporary overlay
printing `screen.height`, `innerHeight`, `documentElement.clientHeight`, `visualViewport.height`,
and the offsetHeights/bottoms of html/body/#app/tabbar. Remove all of it before shipping.

## iPad / tablet layout
- The app is a centered column: `#app{max-width:var(--app-w)}` (`--app-w:520px` on phones).
- A media query `@media (min-width:740px) and (min-height:700px)` turns it into a centered,
  rounded, framed **panel** on an ambient backdrop: `--app-w:720px` (760px on ≥1000×900),
  `body{display:flex;align-items:center;justify-content:center}`, `#app{width:var(--app-w);
  max-width:100%; height:min(100%,900px); border-radius:24px; overflow:hidden}`.
  NOTE: as a flex child `#app` MUST have an explicit `width` or it collapses to content width.
- Gated by BOTH min-width and min-height so iPhone portrait/landscape never trigger it
  (iPhone layout stays exactly as tuned). Verify iPad at 834×1194 (portrait) and 1194×834.
- Manifest is `orientation:portrait` (keeps cramped iPhone-landscape out). iPad landscape
  still renders fine; for the native build, allow iPad landscape in Xcode per-idiom.

## Caching when testing (this wasted a LOT of time)
iOS standalone caches the start URL aggressively. To test a new version reliably:
1. Re-upload `index.html` to GitHub, wait ~1-2 min for Pages to rebuild.
2. Remove the old app from the home screen.
3. Open in Safari with a **fresh** cache-buster query, incrementing each time: `…/?v=14`, `…/?v=15`.
4. If still stale: Settings → Safari → Clear History and Website Data, then retry.
5. Only then Add to Home Screen.
The `sw.js` service worker (network-first) now reduces this: online launches fetch fresh HTML
automatically; cache is only a fallback when offline.

## Testing / verifying changes here
- Validate JS: extract the `<script>` block and `new Function(js)` to catch syntax errors.
- Visual check: Playwright + the preinstalled Chromium. `NODE_PATH=/opt/node22/lib/node_modules`,
  viewport 393×852, `deviceScaleFactor:3`, `isMobile:true`, `hasTouch:true`. Drive the app via
  `page.evaluate` (e.g. `showTab(...)`, `startGame()`), screenshot key screens.
- Chromium does NOT reproduce the iOS standalone viewport bug — confirm those on a real device.

## Git / deploy
- Pushing to a `claude/…` feature branch on `justinndefoer-oss/oche-dart-scorebord` DOES work
  from this container (verified Aug 2026) — `git push -u origin <branch>`. The older note that
  the proxy always 403s is out of date; try the push before assuming it will fail.
- The owner deploys by uploading files via the GitHub web UI, or by merging the branch.
- `*.github.io` is blocked by the container network egress policy, so the live Pages site can't
  be fetched from here — only the owner can verify the deployed site.
