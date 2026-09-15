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
  (hooks/useStreak.ts), `TodayResolution` (hooks/useTodaySet.ts), `TimerState` +
  `TaskTimer` (hooks/useTimer.ts, hooks/useTaskTimer.ts). All day math goes through
  an injectable `Calendar` (default `.current`).
- `Sources/TempoKit/Store/` — the local cache and write queue: `CacheSnapshot`,
  `WriteOp`, and `actor TempoStore`.

### TimerState

`TimerState` is the persisted shape of the task timer, as a value type. Elapsed time is
derived from wall-clock timestamps (`startedAt`, `runningSince`, `accumulatedSeconds`),
not counted by a ticking clock, so a suspended app loses nothing and a relaunch resumes
where it left off. Transitions are pure: `starting(id, at:)`, `paused(at:)`,
`resumed(at:)`, and `stopped(at:)` return the next state (and, for stop, the run's
seconds) so a view model can persist each one. `isStale(at:calendar:)` implements the
overnight rule: a run whose first start was on another calendar day is discarded, not
recorded. `snapshot(at:)` feeds `TimeMath`'s projections. `TaskTimer.stopResult` turns a
stop into `minutesThisRun` / `actualMinutes` via `TimeMath.minutesToRecord`, and
`startPatch` / `stopPatch` give the `TodoPatch` to send afterwards (completion sends the
minutes through `completeTodo` instead). Store the state as JSON via `TempoJSON`.

### Store

`CacheSnapshot` is everything the app shows — todos, events, habits, projects,
preferences, today sets keyed by `yyyy-MM-dd`, and `lastRefresh` — persisted whole as
`cache.json`. `WriteOp` is one queued write (`createTodo`, `updateTodo`,
`completeTodo`, `deleteTodo`, `toggleHabit`, `setTodaySet`, `updatePreferences`); each
case carries its own `id` and `createdAt`, the latter doubling as the "now" used when the
op is applied optimistically so re-applying the queue is deterministic. `TodoDraft.id` is
generated on the client so an offline create can be shown, edited, and completed before
the server hears about it.

`TempoStore` is an actor in front of `TempoClient` that owns both files and applies these
rules: `enqueue` applies an op to the snapshot immediately and appends it to `queue.json`;
`refresh()` pulls the five collections in parallel (`refresh(todayDate:)` /
`refreshToday()` also fetch the day's set and ask the server to generate it when missing)
and then re-applies the queue on top so pending writes never flicker away; `flush()`
replays the queue in order, dropping an op the server rejects with a 4xx and stopping at
the first transport or 5xx failure so the rest survive for next time. Server rows
returned by a flush replace the optimistic ones. `signOut()` wipes both files. Files are
written with `.atomic` (temp file + rename), so a crash mid-write leaves the previous
version intact.

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

### Going through the store

The app should read only from the store's snapshot and write only through `enqueue`, so
every screen behaves the same with or without a network:

```swift
let store = TempoStore(client: client, directory: accountDirectory)

// Launch: show whatever is on disk right away, then refresh and drain the queue.
var snapshot = await store.load()
snapshot = try await store.refreshToday()
_ = await store.flush()

// A write: the snapshot returned already reflects it; flush right after.
snapshot = await store.enqueue(.completeTodo(todoId: todo.id, actualMinutes: result.actualMinutes))
_ = await store.flush()

// Foreground: same two calls as launch, minus load.
```

`flush()` never throws; its `FlushResult` says how many ops were `sent`, `dropped`
(4xx), and are still `remaining`, plus the `error` that stopped it, if any. Give each
account its own `directory` (under Application Support) so `signOut()` can't touch
anything else.
