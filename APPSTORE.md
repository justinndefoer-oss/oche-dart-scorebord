# OCHE → App Store & Play Store (Capacitor)

This wraps the existing web app (the single `index.html` PWA) into a native iOS and
Android app using **Capacitor**, without rewriting anything. The web app stays the single
source of truth at the repo root; `npm run sync-web` copies it into `www/` for the build.

> Honest note: the iOS build **requires a Mac with Xcode**. Android needs Android Studio.
> Everything below runs on your own machine, not in the cloud session. This is not legal/tax
> advice — check Apple's and Google's current terms before publishing.

---

## 0. What you need
- **Mac** with **Xcode 16+** (for iOS — App Store requires the iOS 26 SDK as of 2026).
- **Android Studio** (for Android).
- **Node.js 18+** (`node -v`).
- **Apple Developer Program** — $99/year (to publish on the App Store).
- **Google Play Console** — $25 one-time.

## 1. Get the project on your machine
```bash
git clone https://github.com/justinndefoer-oss/oche-dart-scorebord.git
cd oche-dart-scorebord
npm install
```

## 2. Add the native platforms (one-time)
```bash
npm run add:ios       # creates the ios/ project (Mac only)
npm run add:android   # creates the android/ project
```
(These run `sync-web` first, so `www/` is created automatically.)

## 3. Generate app icons & splash from assets/icon.png
```bash
npm run icons
```
This uses `@capacitor/assets` and the 1024×1024 `assets/icon.png` to produce every
required icon/splash size for both platforms.

## 4. Build & run
```bash
npm run ios       # syncs web + opens Xcode
npm run android   # syncs web + opens Android Studio
```
- **iOS:** in Xcode pick your Team (your Apple Developer account), set a unique Bundle
  Identifier (defaults to `nl.oche.dartscorebord` — change it to your own if needed),
  then run on a device/simulator.
- **Android:** in Android Studio press Run.

Whenever you change the app: re-run `npm run ios` / `npm run android` (it re-syncs `www/`).

## 5. App identity (already configured)
`capacitor.config.json`:
- `appId`: `nl.oche.dartscorebord` (your reverse-domain bundle id — change if you own a domain)
- `appName`: `OCHE`
- `backgroundColor`: `#0b1510` (matches the dark theme)

## 6. Submitting — what reviewers check (most common rejection causes)
- **Fully working, no crashes/placeholders.** Test on a real device. (We ran an automated
  pass across all modes with 0 errors — still test by hand.)
- **Privacy policy** — required for every app, even with no data collection. Add a URL in the
  store listing. (The app stores everything locally and has no accounts — state that.)
- **Accurate metadata** — name, description with keywords, screenshots per device size, age rating.
- **No login needed** — an advantage here; nothing to provide a reviewer.
- **In-app purchases** (only if you add paid extras) must use Apple/Google's billing.

Review time: Apple usually 24–48h; Google Play requires a short closed-testing period first.

## 7. Suggested store text
- **Name:** OCHE — Dart Scorebord
- **Subtitle:** Snel, offline, zonder account
- **Positioning (from the strategy report):** "The fastest, account-free dart app that keeps
  everything offline." 9 game modes (x01, Cricket, Around the Clock, Killer, Shanghai,
  Bob's 27, Count Up, Halve It, Checkout-training), a realistic bot, statistics & history.

## 8. Monetisation (optional, matches the positioning)
Free with an optional one-time "pro" upgrade (extra modes / voice caller / advanced stats),
or fully free with a tip jar. Avoid ads — they clash with the fast, private, local feel.

---

### Files added for this
- `package.json` — Capacitor deps + scripts (`sync-web`, `add:ios`, `add:android`, `ios`, `android`, `icons`)
- `capacitor.config.json` — app id / name / webDir
- `scripts/sync-web.mjs` — copies the root web app into `www/`
- `assets/icon.png` — 1024×1024 source icon for `@capacitor/assets`
- `.gitignore` — excludes `node_modules/`, `www/`, `ios/`, `android/`

The web/PWA version on GitHub Pages keeps working exactly as before — none of this affects it.
