# Tempo for iOS

A native SwiftUI client for the existing Tempo API, with the platform features
a PWA can never have: a timer that survives backgrounding and shows in the
Dynamic Island, reminders that fire when the app is closed, a Home Screen
widget, Siri and Shortcuts capture, and offline that actually works.

**Status:** planned 2026-09-14; decisions confirmed the same day (native SwiftUI,
pasted API key for v1, own device via Xcode). Phase 0 built 2026-09-14.
Decisions originally marked **[you]** are now settled as written.

## Why native, and why now

The web app is feature-complete for the daily loop. What it cannot do on an
iPhone is exactly what an ADHD-first app most needs:

| Gap on the PWA today | Native answer |
|---|---|
| Timer stops being visible the moment you leave the tab | Live Activity in the Dynamic Island and on the Lock Screen |
| Reminders only fire while the tab is open (`useReminderScheduler` polls in the foreground) | `UNUserNotificationCenter` schedules them from `reminder_at`; they fire with the app closed |
| Offline banner says "changes saved locally" but nothing is | Local cache plus a write queue |
| Capture means opening the app | Share extension, Siri, Shortcuts, a widget button |
| Mood sync to Apple Health is on the backlog | HealthKit |

Everything else stays where it is. The API, Postgres, the autoplan and calendar
crons, the MCP server, and the web app are untouched except for the small
server additions in Phase 0.

## Decisions

1. **Native SwiftUI, not a wrapped web view. [you, but recommended]** A Capacitor
   shell would ship in a weekend and give you a Home Screen icon that looks
   like an app, but none of the table above. React Native would let you share
   the hooks, but the hooks are the least valuable part of the codebase. The
   pure logic is small (about 700 lines across `scoring`, `time`,
   `calibration`, `availability`, `recurrence`) and ports cleanly to Swift with
   tests, which the repo has never had.
2. **iOS 26 minimum, Swift 6, Xcode 26.6.** You have Xcode 26.6 and an iOS 26.5
   simulator installed. One OS target keeps the code honest; there is no one
   else to support.
3. **Auth in v1 is an API key, not Firebase. [you]** Settings on the web already
   mints scoped keys, and the API treats a key with `read`, `write`, and `ai`
   as a full user. The iOS app pastes or scans a key once and stores it in the
   Keychain. This skips the Firebase iOS SDK, Google Sign-In on iOS, the
   Sign in with Apple requirement that comes with any App Store submission,
   and the Better Auth migration entirely. Firebase or Better Auth can replace
   it in Phase 5 without touching any other screen. Two limits to know:
   the app cannot mint or revoke keys (that route is Firebase-only by design),
   and `GET /api/auth/me` returns only what Firebase knows about the key's owner.
4. **Distribution is your own device first. [you]** Xcode signs to your iPhone
   for free with a 7-day certificate, which is fine for the first month.
   TestFlight needs the $99 Apple Developer Program and gives 90-day builds
   and no re-plugging. App Store submission is a separate conversation that
   brings Sign in with Apple and review with it.
5. **Scope is the daily loop first.** Today, Focus, capture, Backlog, Habits.
   Notes, Playlists, Plan My Day, Insights, Weekly Review, and AI chat come
   after, in that order, because that is roughly how often you touch them.
6. **The server does the thinking that clients keep re-implementing.** The web
   client generates the daily set, advances recurrence on completion, and
   scores candidates, all in the browser. The MCP server's `complete_todo`
   already misses recurrence because of this. Phase 0 moves those three into
   endpoints so iOS, web, and MCP share one implementation.

## Architecture

```
tempo/
├── ios/
│   ├── Tempo.xcodeproj
│   ├── Tempo/                 SwiftUI app target
│   ├── TempoWidgets/          widget + Live Activity extension
│   ├── TempoShare/            share extension (Phase 3)
│   └── TempoKit/              local Swift package: models, API client, logic, tests
└── (everything else unchanged)
```

**TempoKit** is where the value is. A Swift package with no UI:

- `Models/` mirror `api/src/db/schema.ts` exactly. `Codable`, camelCase as the
  API sends it, ISO-8601 dates with fractional seconds. Enums for
  `TodoStatus`, `TodoSize`, `EnergyLevel`, `RecurrenceFrequency`.
- `API/TempoClient` wraps `URLSession` with the base URL, the `X-API-Key`
  header, JSON coding, and one method per endpoint. SSE streaming for the
  Anthropic proxy in Phase 4 uses `URLSession.bytes(for:)`.
- `Logic/` ports the pure TypeScript modules one for one: `Scoring`,
  `TimeMath`, `Calibration`, `Availability`, `Recurrence`. Each port ships with
  the same fixtures as the verification scripts that were run against the
  TypeScript, so the two stay provably in step.
- `Store/` holds the local cache and the write queue (Phase 2).

**The app target** is plain SwiftUI with `@Observable` view models, one per
screen, talking only to `TempoKit`. No third-party dependencies in v1.

### Server gotchas the client must respect

- **Body date coercion.** `api/src/index.ts` rewrites any top-level body
  string matching `YYYY-MM-DD` or `YYYY-MM-DDT…` into a `Date`. Send dates as
  full ISO-8601 strings and never send a bare date as a title.
- **Rate limits.** 300 requests a minute per user, 30 a minute on the AI
  proxy. A naive "refetch everything on every screen" design will hit these;
  the cache in Phase 2 is also the fix.
- **Read-only Google events.** Rows with `source: "google"` must not be edited
  or deleted; the API 403s and the UI should not offer it.
- **Today set is a morning snapshot.** Resolve its ids against the live todo
  list and drop anything not `today_pinned` or `backlog`, as `useTodaySet`
  does.

## Design translation

The design system moves over as an asset catalog and a small `Theme` type:

- **Colors.** Every `@theme` token becomes a named color with light and dark
  variants: `surface` `#f9f9f8` / `#1a1c1b`, the five container steps,
  `primary` `#4f645b` / `#8fb5a4`, `onSurface`, `onSurfaceVariant`,
  `outlineVariant`, `error` `#a83836` / `#e5726f`. Chip palettes (8 project
  hues, 4 energy, 3 size, 5 impact) come along the same way.
- **Energy-adaptive theme.** The four `data-energy` overrides become a
  `Theme.energy` case that swaps the primary and surface set. Same mechanism
  as the web, driven by `preferences.currentEnergy`.
- **Type.** Bundle Manrope 500 to 800 for display and Inter 400 to 600 for
  body. The web loads them from Google Fonts; the app ships the files.
- **Shape.** 8 px grid, 16 px card radius, no borders, hierarchy from the
  surface ramp. SwiftUI's default rounded rectangles and materials are close
  enough that this is mostly restraint rather than work.
- **Liquid Glass.** iOS 26's default chrome fits the "No-Line" rule well. Use
  the system tab bar and toolbar rather than fighting them.

## Phases

### Phase 0: server preparation (one PR, no iOS code)

Three endpoints so every client shares one brain, plus one cleanup.

| Change | Why |
|---|---|
| `POST /api/todos/:id/complete` with optional `actualMinutes`; sets status and `completedAt`, creates the next occurrence for recurring todos | Web, iOS, and MCP all complete todos; only the web advances recurrence today |
| `POST /api/today-set/generate` runs the existing server-side scoring from `api/src/lib/autoplan.ts` on demand and stores the set | Today's set is generated in the browser by `useTodaySet`; iOS would otherwise re-implement `scoring.ts` and the Chore gate a third time |
| `GET /api/todos?status=…&since=…` filters | The list is every todo the user has ever had; a phone should not download it on every launch |
| Move the web client onto the two new endpoints | So there is one path, not two |

Effort: S. Verified the house way: scripts against the real functions, plus
the web app exercised in the browser.

### Phase 1: skeleton you can run on your phone

- Xcode project, `TempoKit` package, CI-free but `swift test` runs.
- Models, `TempoClient`, and the five logic ports with their fixture tests.
- Sign-in screen: paste an API key, verify with `GET /api/auth/me`, store in
  Keychain.
- Today screen, read-only: the summary line, today's events, the list.
- Runs on the simulator and on your iPhone via Xcode.

Effort: M. This is the phase that proves the API is enough.

### Phase 2: the daily loop

- Today: start, pause, stop, complete, defer, start-timer on a row, the Now
  card. The timer is a **Live Activity** so it is visible in the Dynamic
  Island and on the Lock Screen while you do the task.
- Capture: an Inbox screen with a text field that is focused on open, and the
  smart-capture suggestions via the AI proxy.
- Todo detail, Backlog, Focus Mode with the same Done / Skip / Not now /
  Break actions and the breathing pause.
- Habits with the day grid and toggle.
- **Local cache and write queue.** All lists cached on disk; writes go to a
  queue that drains when online, with the API's own idempotent `PUT` shapes
  and client-generated UUIDs on create (the API already accepts them).
- Reminders as scheduled local notifications from `reminderAt`, rescheduled
  whenever the todo list syncs.

Effort: L. This is the app.

### Phase 3: things only a native app can do

- Home Screen widget: today's remaining tasks and the running timer; a
  "Start next" button via App Intents.
- Siri and Shortcuts: "Add to Tempo", "What's on Today", "Start focus".
- Share extension: text or a link becomes an Inbox todo.
- Haptics on complete; a gentler sparkle in SwiftUI.
- Mood logging to HealthKit's State of Mind, the backlog item.

Effort: M. Each is small once Phase 2 exists.

### Phase 4: breadth

Notes (Markdown editing), Playlists with Start & focus, Plan My Day, Insights
and Weekly Review including the Time sense section, Tempo AI chat with tool
use against `TempoKit`'s mutations, Google Calendar connect via
`ASWebAuthenticationSession` watching for the existing callback URL.

Effort: L, but every screen is independent and can ship one at a time.

### Phase 5: real accounts, more screens

Firebase iOS SDK with Google Sign-In, or Better Auth if that migration
happens first. iPad layout with a sidebar. A Mac build via SwiftUI
multiplatform, which is mostly free once iPad works.

## What this costs

Phases 0 to 2 are the commitment; 3 onward is optional polish that happens at
whatever pace you like. In evenings-and-weekends terms, Phase 1 is a weekend,
Phase 2 is several. There is no test framework in the web repo, so
`TempoKit`'s tests will be the first real tests Tempo has had, which is a
side benefit worth having regardless.

## Not in scope

- Replacing the web app. It stays the desktop client and the admin surface
  for API keys and Google Calendar.
- Push notifications from the server. Local notifications cover reminders
  and the autoplan result can be fetched on launch; APNs can come later if a
  server-originated alert ever matters.
- Android.

## Open questions for you

1. Native SwiftUI, agreed?
2. API-key sign-in for v1, with real accounts deferred to Phase 5?
3. Personal device via Xcode first, or is the Developer Program worth buying
   now for TestFlight?
4. Anything in Phase 4 you'd pull forward, or anything in Phase 2 you'd cut?
