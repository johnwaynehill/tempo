# Tempo for iOS

Native SwiftUI client for the Tempo API. Phase 1: sign in with an API key and a
read-only Today screen. Phase 2: the daily loop — Today with the summary line
and Now card, Focus Mode, Inbox capture, Backlog, todo detail, Habits, local
reminders, an offline cache with a write queue, and the timer's Live Activity.
The plan and later phases live in `Docs/iOSApp.md`.

```
ios/
├── project.yml        XcodeGen spec (source of truth for the project)
├── Tempo.xcodeproj    generated; committed so it opens without extra tools
├── Tempo/             the app target (SwiftUI, @Observable view models)
│   └── AppModel.swift one shared source of truth; every write goes through it
├── TempoWidgets/      widget extension: the timer's Live Activity
├── Shared/            compiled into both targets: Live Activity attributes, WidgetTheme
└── TempoKit/          local Swift package: models, TempoClient, logic ports, tests
```

## Open and run

1. Open `ios/Tempo.xcodeproj` in Xcode 26.6 or newer.
2. Select the `Tempo` scheme and any iOS 26 simulator, then press Run.
3. On first launch paste an API key. Mint one on the web app under
   Settings → API Keys; it needs `read` and `write` (and `ai` for later phases).
   The key is stored in the Keychain and verified with `GET /api/auth/me`.

If you change `project.yml` or add files outside Xcode, regenerate the project:

```sh
brew install xcodegen     # once
cd ios && xcodegen generate
```

## Run on your iPhone

1. In the project navigator pick the `Tempo` target → Signing & Capabilities.
2. Tick "Automatically manage signing" and choose your Team (a free Apple ID
   works; builds expire after 7 days without the Developer Program).
3. Plug in the phone, select it as the run destination, and Run. The first time,
   trust the developer certificate on the phone under
   Settings → General → VPN & Device Management.

`DEVELOPMENT_TEAM` lives under `settings.base` in `project.yml` so that
`xcodegen generate` keeps the team picked in Xcode; change it there, not in the
project file, if you sign with a different team.

## Pointing at a local API

The app talks to `https://tempo-api-production.up.railway.app` by default.
Override with `TEMPO_API_URL`, either as an environment variable or as a
`-TEMPO_API_URL <url>` launch argument:

- In Xcode: Product → Scheme → Edit Scheme → Run → Arguments. The `Tempo`
  scheme already has a disabled `TEMPO_API_URL = http://localhost:3001` entry;
  tick it.
- From the command line: `xcrun simctl launch --setenv TEMPO_API_URL=http://localhost:3001 booted com.johnwaynehill.Tempo`
  (the simulator shares the Mac's localhost; a physical phone needs the Mac's
  LAN address instead).

`Info.plist` sets `NSAllowsLocalNetworking` so plain `http://localhost` is allowed.

`TEMPO_API_KEY=<key>` in the environment signs in with that key for the run
without touching the Keychain (simulator checks only).

## Offline cache and the timer

`AppModel` sits on `TempoKit`'s `TempoStore`: the last snapshot is cached under
Application Support/Tempo/<12 hex chars of SHA-256(api key)> and rendered the
moment the app launches, then refreshed. Every write is applied locally and
queued; a non-blocking flush drains the queue after each write, when the scene
becomes active, and on pull-to-refresh. Today shows a one-line "Offline" note
only while something is queued and the last flush couldn't reach the server.

The task timer (`TimerState`) is persisted to `UserDefaults` under
`tempo-timer-state`, discarded on load if it started on another day, and drives
the Now card, Focus Mode, and the Live Activity from one clock. Elapsed time is
always derived from timestamps, never counted.

## Debug launch hooks

Debug builds read a few environment variables once after Today's first load, so
the app can be driven from the command line where nothing can tap the
simulator (`Tempo/DebugLaunch.swift`; compiled out of Release):

| Variable | Effect |
| --- | --- |
| `TEMPO_DEBUG_START_TIMER=1` | Start the timer on the first Today todo, then log `Activity<TempoTimerAttributes>.activities.count` |
| `TEMPO_DEBUG_FOCUS=1` | Open Focus Mode |
| `TEMPO_DEBUG_CAPTURE=<title>` | Create an inbox todo with that title |
| `TEMPO_DEBUG_COMPLETE_AFTER=<seconds>` | Call `completeActive()` after that many seconds |
| `TEMPO_DEBUG_SHARE="text\|url\|title"` | Run the share extension's `ShareCapture` with the stored key (needs `TEMPO_DEBUG_STORE_KEY=1`): sends an Inbox todo, or writes it to the App Group `Inbox/` when the server is unreachable (`Tempo/DebugShareHook.swift`) |
| `TEMPO_DEBUG_SHARE_PREVIEW=1` | Present the share sheet's card over the app with sample data; `saving`, `added`, `queued` or `error` shows that state |
| `TEMPO_DEBUG_SPARKLE=1` | Fire every completion sparkle on screen three times, 3 s apart |
| `TEMPO_DEBUG_SPARKLE_SCALE=<n>` | Slow the sparkle down n times (for screenshots) |
| `TEMPO_DEBUG_REDUCE_MOTION=1` | Treat Reduce Motion as on (the sparkle then never renders); `simctl` can't toggle it |
| `TEMPO_DEBUG_MOOD_SHEET=1` | Present the mood check-in sheet |
| `TEMPO_DEBUG_MOOD_HEALTH=1` | Turn "Also save to Apple Health" on and request State of Mind access |
| `TEMPO_DEBUG_LOG_MOOD=<value>:<note>` | Save a check-in through the sheet's save path (and to Health if the toggle is on) |

With `simctl` prefix each one with `SIMCTL_CHILD_`, e.g.
`SIMCTL_CHILD_TEMPO_DEBUG_START_TIMER=1 xcrun simctl launch booted com.johnwaynehill.Tempo`.
Log lines land in the `com.johnwaynehill.Tempo` subsystem:
`xcrun simctl spawn booted log stream --predicate 'subsystem == "com.johnwaynehill.Tempo"' --style compact`.

Extensions (widget, share sheet, App Intents) read the API key and server address from the shared Keychain, not from the environment. For simulator checks of those, add `TEMPO_DEBUG_STORE_KEY=1` alongside `TEMPO_API_KEY` / `TEMPO_API_URL` so the DEBUG build saves them there. Simulator builds that exercise the App Group or Keychain group also need entitlements, so build with ad-hoc signing rather than `CODE_SIGNING_ALLOWED=NO`:

```bash
xcodebuild -project Tempo.xcodeproj -scheme Tempo -destination 'platform=iOS Simulator,id=<device id>' CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= build
```

## Mood check-ins, Apple Health, haptics

Today's top row shows the mood logged today (blob, label, note from `GET /api/mood?days=1`)
or "How are you feeling?". Tapping opens `MoodCheckInSheet`: a 1–100 slider that reshapes
the blob, an optional note, and **Also save to Apple Health** (`UserDefaults`
`tempo-mood-save-to-health`, off by default; switching it on asks for access). Save posts to
`/api/mood` first; with the toggle on it then writes an `HKStateOfMind` (momentary emotion,
valence linear from 1–100 to −1…1, labels per bucket, see `HealthMoodWriter.swift`). If Health
is unavailable or not allowed, the mood still saves and the sheet says Health wasn't updated.
Mood logging is online only (it isn't a queued `WriteOp`); offline, the sheet says so and stays open.

Completing a todo from the Now card, a Today row, Focus Mode or the todo detail plays a success
haptic; starting, pausing or resuming the timer plays a light impact. The Now card and Today
rows also play `CompletionSparkle`, a ~600 ms burst of sage and neutral dots, skipped entirely
when Reduce Motion is on.

## Building from the command line

```sh
cd ios
xcodebuild -project Tempo.xcodeproj -scheme Tempo \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

## TempoKit tests

TempoKit is a plain Swift package, so its tests run without Xcode's UI:

```sh
cd ios/TempoKit
swift test
```

The suites port the web client's verification scripts, so the Swift logic is
checked against the same expected values as the TypeScript. See
`TempoKit/README.md` for what the package contains.

## Design

Tokens are in `Tempo/Theme.swift` and follow `Docs/Design.md` ("Quiet Rhythm"):
no borders, hierarchy from the surface ramp, 16pt card radius, 8pt grid, muted
sage primary. Fonts go through `Theme.font(...)` so Manrope/Inter can be bundled
later without touching views.

## App icon

The icon comes from Figma "Tempo-Web", node `4:2` ("app-icon-editable 2"): the sage-gradient "T." monogram on white. Note the web favicon and PWA icons in `public/` are the inverse (sage background, cream monogram).

- Sources live in `ios/Branding/AppIcon/` as SVG: `AppIcon-Light.svg` (the Figma design, opaque full-bleed square — iOS applies the corner mask), `AppIcon-Dark.svg` (same geometry, transparent background, gradient lifted toward the dark-theme primary), and `AppIcon-Tinted.svg` (grayscale, transparent, for tinted Home Screens).
- Render the PNGs into the asset catalog from the repo root:

  ```bash
  node ios/scripts/generate-app-icon.mjs
  ```

  It uses `sharp` from the web app's `node_modules` (`npm install` at the root first). The light icon is flattened with no alpha channel, which iOS requires.
- To change the icon, edit the SVGs (or re-export from Figma) and re-run the script. Don't hand-edit the PNGs.
