# Time visibility v2

Making time tangible on the Today page, learning from what actually happens,
and catching over-planning before it happens.

**Status:** planned 2026-09-02. Phase 1 shipped 2026-09-11 (PR #117). Phase 2 built 2026-09-12 (`feature/time-calibration`); phases 3–4 not started.

## What already exists (don't rebuild)

The research doc's "Tier 1" time-blindness features shipped in April (PRs #46–#49):

| Shipped | Where |
|---|---|
| Elapsed timer with pause/resume, session-persisted | `src/hooks/useTimer.ts` |
| One-task Focus Mode with progress ring, overtime, transition pause, break, Not-Now capture | `src/pages/FocusMode.tsx` (`/focus`, key `F`) |
| "Done by ~4:37 PM" projection | `src/pages/PlanMyDay.tsx:96-103` (confirm step) |
| Time estimates on todos (`estimated_minutes`, size fallback 15/30/60, default 25) | schema + `PlanMyDay`, `TodoDetailPage` chip editors |
| Guided morning planning | `/plan` |

What is **not** there, per `Future.md` and the PRD backlog:

1. Nothing time-related on the Today page itself. `TimerBar` was pulled from Today in
   commit `4520768` ("timer is Focus-only") and `src/components/ui/TimerBar.tsx` is
   now dead code. Time is only visible if you enter Focus Mode.
2. Elapsed time is thrown away on complete. No `actual_minutes`, no `started_at`, so
   Weekly Review cannot show estimate calibration.
3. No overcommitment check. The projection says *when* you'd finish but never
   compares that to the hours you actually have.

This plan closes those three gaps, in that order, one PR each.

## Principles

- **Time as a quantity, not an alarm.** Progress fills with sage, never a red
  countdown. Overtime is a softer tint, not an error state (`Design.md` §5, §6).
- **No duplicate information.** The active task lives in one card, not in the card
  *and* in the list (`Future.md` → Today View).
- **Shame-free copy.** "Ran about 20 minutes over" is a fact. "You're behind" is a
  judgment. Only the first kind ships.
- **Pure math in `src/lib/`, verified by script.** Same pattern as `scoring.ts`
  and how #113–#116 were verified. There is no test runner in this repo.

---

## Phase 1 — The Now card on Today

**Goal:** the Today page shows the whole day's time shape and the current task's
timer, without leaving the page or entering Focus Mode.

### Behaviour

**No timer running.** A single quiet line sits between `TodaysEvents` and the task
list:

> 5 tasks · 2h 15m · done by ~4:37 PM &nbsp;&nbsp;&nbsp; ▶ Start

"Start" begins the timer on the first todo. Each `TodoItem` also gets a play
affordance (hover on desktop, always-visible ghost icon on touch) so any task can
be started directly.

**Timer running.** The active todo's row is removed from the list and re-rendered as
the **Now card** at the top of the list:

```
┌──────────────────────────────────────────────┐
│ Clean kitchen                    12:45 / 30m │
│ ████████████░░░░░░░░░░░░░░░░  (sage fill)    │
│ ⏸  ■                    Done by ~4:37 PM  ✓  │
└──────────────────────────────────────────────┘
```

- Title, chips, elapsed / estimate, a thin progress bar that fills with `primary`.
  Past the estimate the bar stays full and the elapsed text shifts to `primary`.
  No pulse, no red.
- Actions: pause/resume, stop (timer off, todo stays in list), **complete**. Complete
  is the same 700 ms sparkle path as `TodoItem`, then the card collapses and the
  summary line updates.
- "Done by" is recomputed every tick: `max(0, activeEstimate − elapsed) + Σ other
  estimates`. (The old `TimerBar` subtracted elapsed from the *total*, which is wrong
  once you're past the estimate.)
- Tapping the title opens `TodoDetailPage`, same as a list row.

The timer is the same `useTimer` instance Focus Mode uses, so pressing `F` picks
up the running task with its elapsed time intact, and returning to Today shows it
in the Now card.

### Code changes

| Change | File |
|---|---|
| New pure helpers: `getEstimate(todo)`, `remainingMinutes(todos, timer)`, `projectedEndTime(...)`, `formatClock(date)` | **new** `src/lib/time.ts` |
| Replace the four copy-pasted `getEstimate` functions with the shared one | `TimerBar.tsx` (deleted), `FocusMode.tsx:11`, `PlanMyDay.tsx:21`, `PickForMeCard.tsx:12` |
| Replace the inline end-time math with `projectedEndTime` | `PlanMyDay.tsx:96-103` |
| New `NowCard` + `DaySummaryLine` components | **new** `src/components/today/NowCard.tsx` |
| Mount `useTimer`, render summary/Now card, filter active todo out of the list, pass `onStart` to `TodoItem` | `src/pages/Today.tsx` |
| Optional `onStart` prop with play affordance | `src/components/ui/TodoItem.tsx` |
| Delete dead component | `src/components/ui/TimerBar.tsx` |

### Timer hardening (same PR)

`useTimer` has two problems that matter once the timer is visible on the main page:

1. **`sessionStorage`** dies when the PWA tab is closed. On iPhone that is every time
   you switch apps for long enough. Move to `localStorage` under the same key.
2. **Tick-based elapsed** drifts when the tab is backgrounded (browsers throttle
   `setInterval` to ≥1 s, often much more). Store `accumulatedSeconds` +
   `runningSince` and derive `elapsed = accumulated + (now − runningSince)` on each
   render tick. The tick then only forces a re-render; it never carries state.

Both are contained in `useTimer.ts`; the public `UseTimerResult` shape is unchanged
except for one addition: `stop()` returns the final elapsed seconds (Phase 2 needs it).

### Verification

- Script against `src/lib/time.ts`: projection with no timer, with timer under
  estimate, with timer 20 min over estimate, with a single todo, with zero todos.
- Real browser: start on Today, close the tab, reopen → elapsed continued. Background
  the tab 3 minutes → elapsed matches wall clock. Press `F` → Focus Mode shows the
  same task and elapsed.
- `npx tsc -b` clean. No API or schema changes.

**Effort:** M. Mostly wiring; the math and the Focus Mode UI are already proven.

---

## Phase 2 — Remember how long things took

**Goal:** completing a timed task records its actual duration, and Weekly Review
turns that into a calibration read-out.

### Schema

```sql
-- Docs/migrations/2026-09-XX-todo-actual-minutes.sql (apply by hand; do not db:push)
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS started_at     timestamptz,
  ADD COLUMN IF NOT EXISTS actual_minutes integer;
```

- `started_at`: first time the timer was started on this todo. Never overwritten.
- `actual_minutes`: total timed minutes, accumulated across sessions (start → stop →
  start again on another day adds up). Written on `stop()` and on complete.
  Rounded, minimum 1.

`api/src/routes/todos.ts` `PUT` spreads the body into `.set()`, so no route change is
needed. Add both fields to `src/types/index.ts`, the camel↔snake maps in
`src/lib/api.ts`, and `started_at` to the `TODO_DATES` list.

### Write path

- `useTimer.start(taskId)` → if the todo has no `started_at`, `updateTodo(id, { started_at: now })`.
- `useTimer.stop()` → returns elapsed; caller does
  `updateTodo(id, { actual_minutes: (todo.actual_minutes ?? 0) + round(elapsed/60) })`.
- `completeTodo(id, { actualMinutes? })` in `useTodos.ts` merges the same way. Both
  `Today.tsx` (Now card complete) and `FocusMode.tsx:handleComplete` pass it.
- Untimed completions leave `actual_minutes` null. They are simply excluded from
  calibration rather than guessed.

### Weekly Review: "Time sense"

New section in `src/pages/WeeklyReview.tsx` after the on-time bar (≈ line 182),
fed by new fields on `InsightsData` in `useInsightsData.ts`:

```ts
timedCount: number          // completions in range with both estimate and actual
estimatedMinutes: number
actualMinutes: number
calibration: number | null  // actual / estimated, null if timedCount < 3
bySize: { size, estimated, actual, count }[]
byProjectTime: { project, estimated, actual, count }[]  // top 3 by count
```

Rendering:

- Hidden entirely below 3 timed completions. Nothing to say yet, so say nothing.
- One headline sentence, always neutral in tone:
  - ratio 0.85–1.15 → "Your estimates were close this week."
  - ratio > 1.15 → "Tasks ran about 40% longer than you guessed."
  - ratio < 0.85 → "Tasks finished about 20% faster than you guessed."
- Two `HorizontalBarChart`s side by side: by size, by project, each bar pair
  estimated (`surface-container-high`) vs actual (`primary`).
- One optional pattern line when a size or project is > 1.3× over with count ≥ 3:
  "Writing tasks tend to take about 1.5× your estimate."

### Feed the estimate back

`PlanMyDay` and `TodoDetailPage` estimate chips get a small hint under the row when
a calibrated ratio for that size exists: "Medium tasks usually take you ~45m."
Pure lookup against the last 4 weeks; no auto-adjustment of the user's estimate.

### MCP

`list_todos` / `get_today` already return the raw row, so `actual_minutes` and
`started_at` show up for free. Add an optional `actual_minutes` argument to
`complete_todo` so an agent completing a task can record it. Document in `Docs/API.md`.

### Verification

- Script: `useInsightsData`-style calibration function against a constructed set
  (mixed timed/untimed, ratios above/below/within band, one project over 1.3×).
- Real data: apply migration to prod, time two real tasks over a day, confirm rows and
  the Review section renders (or stays hidden under 3).
- `npx tsc -b` clean on both frontend and `api`.

**Effort:** M. The migration is trivial; the Review UI is the bulk.

---

## Phase 3 — Overcommitment detection

**Goal:** when the plan does not fit in the hours left, say so once, gently, at the
moment it can still be changed.

### The math

```ts
// src/lib/time.ts
computeAvailability({ now, dayStart, dayEnd, events }): {
  windowMinutes    // dayEnd − max(now, dayStart), floored at 0
  busyMinutes      // Σ timed (not all_day) events clipped to that window, merged overlaps
  freeMinutes      // window − busy
}
overcommitment(freeMinutes, plannedMinutes): number  // planned − free, ≤ 0 means fits
```

- All-day events are **not** blocking. The 2026-06-17 timezone fix stores them at noon
  UTC, so their times must not be read as busy blocks.
- Events come from `useEvents()`, which returns every event. Filter to today with
  `toISODateString` the same way `dayEvents.tsx:splitDayEvents` does.
- Everything is client-local time, consistent with the rest of the client.

### New preference: working hours

`user_preferences` gains `work_day_start` and `work_day_end` (`text`, `"HH:MM"`,
defaults `"09:00"` / `"17:00"`).

- Migration `Docs/migrations/2026-09-XX-work-hours.sql` (additive, by hand).
- Schema, `src/types/index.ts`, `DEFAULT_PREFS` and the **explicit whitelist in
  `usePreferences.ts:24-31`** (a new field is silently dropped without it).
- Settings → Preferences: two time inputs under the autoplan block (≈ line 438),
  labelled "Working hours" with helper text "Used to check whether today's plan fits."

### Where it shows

1. **Plan My Day, confirm step** (`PlanMyDay.tsx` ≈ line 363, under "Done by ~"):
   > About 6h planned, and roughly 4h free before 5 PM. Want to move something to tomorrow?
   Tapping a selected task in that step already deselects it; no new control needed.
2. **Today, summary line / Now card footer:** same sentence in
   `text-on-surface-variant`, only while `overcommitment > 30` minutes. Disappears as
   tasks complete or get deferred. Never red, never an icon.
3. Nothing before 09:00 or after `work_day_end` (the window is 0 and the message
   would be noise).

Threshold of 30 minutes avoids nagging over rounding.

### Verification

- Script: window before/inside/after work hours, overlapping events, an all-day
  event, an event spanning the window edge, planned exactly equal to free.
- Real browser with a real calendar day: confirm the sentence appears in Plan My Day
  and clears on Today after deferring one task.
- `npx tsc -b` clean on both.

**Effort:** M. Two small migrations plus one pure function; the UI is two sentences.

---

## Phase 4 (stretch) — Playlists that play

`Future.md` still lists "auto-advance between steps with timer" for Routine Playlists.
After Phase 1, `POST /playlists/:id/start` pins the steps in order and Focus Mode
already walks pinned todos with a timer, transition pause and auto-advance. The whole
feature is one button: **Start & focus** on `PlaylistDetail.tsx`, which calls start
then navigates to `/focus`. Voice guidance stays out of scope.

**Effort:** S.

---

## Sequence and PRs

| PR | Branch | Contains | Migration |
|---|---|---|---|
| 1 | `feature/today-now-card` | Phase 1 + timer hardening + `src/lib/time.ts` | none |
| 2 | `feature/time-calibration` | Phase 2 | `todos.started_at`, `todos.actual_minutes` |
| 3 | `feature/overcommitment` | Phase 3 | `user_preferences.work_day_start/end` |
| 4 | `feature/playlist-focus` | Phase 4 | none |

Each PR updates `CHANGELOG.md` (one date header per day), ticks the row in
`PRD.md` § Remaining Backlog, and strikes the item in `Future.md`. PR 2 and 3
migrations are applied by hand to prod **before** the API deploy, never via `db:push`.

## Decisions taken (change if you disagree)

- The Now card **replaces** the active todo's list row rather than sitting above a
  duplicate, per the `Future.md` note.
- Timer state moves to `localStorage`. A stale running timer from yesterday is shown
  as-is with its real elapsed; the user stops it. No auto-expiry in v1.
- Working hours are a fixed daily window, not per-weekday. Per-weekday can come later
  if the fixed window proves wrong on weekends.
- Untimed completions are excluded from calibration; there is no "how long did that
  take?" prompt on complete. That prompt is friction on the exact action that should
  have none.
- Calibration hides below three data points rather than showing a shaky number.
