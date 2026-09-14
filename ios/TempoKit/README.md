# TempoKit

A local Swift package for the native iOS client of Tempo. No third-party dependencies;
Swift 6 language mode with strict concurrency, so every model is `Sendable`.

## What's in it

- `Sources/TempoKit/Models/` — `Codable` structs mirroring `api/src/db/schema.ts`
  (`Todo`, `Note`, `Project`, `Habit`, `CalendarEvent`, `UserPreferences`, `TodaySet`,
  `Playlist`/`PlaylistItem`, `MoodEntry`, `WeeklyReview`, `Conversation`, `AiUsageSummary`)
  plus the raw-string enums (`TodoStatus`, `TodoSize`, `EnergyLevel`, …). `TodoDraft` and
  `TodoPatch` are the create/update bodies; `Patch<T>` gives a patch field three states
  (untouched, set, explicit null).
- `Sources/TempoKit/TempoJSON.swift` — the shared decoder/encoder. Accepts ISO-8601 dates
  with or without fractional seconds and always writes them with.
- `Sources/TempoKit/API/TempoClient.swift` — `actor TempoClient(baseURL:apiKey:)`. Sends
  `X-API-Key` on every request; `TempoAPIError` maps 401/403 to `.unauthorized`.
- `Sources/TempoKit/Logic/` — one-for-one ports of the web client's pure modules:
  `TimeMath` (src/lib/time.ts), `Calibration` (calibration.ts), `Availability`
  (availability.ts), `Recurrence` (recurrence.ts), `Scoring` (scoring.ts), `Streaks`
  (hooks/useStreak.ts), `TodayResolution` (hooks/useTodaySet.ts). All day math goes through
  an injectable `Calendar` (default `.current`).

## Running the tests

```sh
cd ios/TempoKit
swift build
swift test
```

The suites under `Tests/TempoKitTests/` include ports of the TypeScript verification
scripts (`verify-time`, `verify-calibration`, `verify-availability`), so the Swift and
TypeScript implementations are checked against the same expected values. Tests pin
`America/Los_Angeles` so they pass on any machine.

## Using it from an app

Add the package as a local dependency (`ios/TempoKit`), then:

```swift
import TempoKit

let client = TempoClient(apiKey: key)          // defaults to the production API
let todos = try await client.todos(status: .backlog)
let plan = Scoring.suggestTodayTodos(todos, currentEnergy: .medium)
try await client.updateTodo(id: plan[0].id, TodoPatch(status: .set(.todayPinned)))
```

Send dates only through the models (they're encoded as full ISO-8601 timestamps). The API
rewrites any top-level body string that starts with `yyyy-MM-dd` into a Date, so a bare date
in a text field such as `title` will not survive the round trip.
