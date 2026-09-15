# Tempo for iOS

Native SwiftUI client for the Tempo API. Phase 1: sign in with an API key and a
read-only Today screen. The plan and later phases live in `Docs/iOSApp.md`.

```
ios/
├── project.yml        XcodeGen spec (source of truth for the project)
├── Tempo.xcodeproj    generated; committed so it opens without extra tools
├── Tempo/             the app target (SwiftUI, @Observable view models)
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

`DEVELOPMENT_TEAM` is deliberately not set in `project.yml`; Xcode writes your
choice into the project file, and `xcodegen generate` will drop it again, so
either re-pick the team after regenerating or add
`DEVELOPMENT_TEAM: <your team id>` under `settings.base` in `project.yml`.

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
