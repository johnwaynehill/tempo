# Claude Routines

Scheduled Claude Code conversations that run automatically against this project. Each routine fires on a cron schedule, wakes up a fresh Claude (no memory of prior runs), and uses the configured MCP servers — including `tempo-mcp` — to do its work.

Routines run while the Claude Code app is open. If the app is closed when a routine is due, it runs on next launch.

## Active routines

### `nightly-tempo-plan`

- **Schedule:** every day at 9:00 PM Pacific Time (cron `0 21 * * *`, evaluated in local time).
- **What it does:**
  1. Calls `mcp__tempo-mcp__list_todos` with `status: backlog` and `status: inbox` to gather candidates.
  2. Calls `mcp__tempo-mcp__get_preferences` for current energy + time prefs.
  3. Picks 3–5 todos that fit tomorrow's likely energy/time budget, biased toward higher-impact and soon-due items.
  4. For each pick, drafts a short implementation plan (approach, files/surfaces, risks, rough size).
  5. Saves the whole plan as a single Tempo Note titled `Plan for YYYY-MM-DD` (tomorrow's date in PT) via `mcp__tempo-mcp__create_note`.
- **Where to read the output:** the Notes view in Tempo each morning. Title is `Plan for <tomorrow>`.
- **Side effects:** none on app data. The routine does not modify todos, log mood/energy, or touch habits.

## Known issue: harness terminates scheduled-task sessions early

Observed 2026-05-21 and 2026-05-22: when `nightly-tempo-plan` fired autonomously, the Claude session for the run terminated after ~7 seconds and only 3 turns (one `thinking`, one `Bash` for the date lookup, one `ToolSearch` to load `tempo-mcp` tools) — before any tool results came back, before any Tempo data was read, and before any note was created. The harness records `lastRunAt` so it looks like the run succeeded, but no work was done.

Symptom in Tempo: no `Plan for <tomorrow>` note appears the next morning even though `lastRunAt` is set.

**Workaround until this is understood:** re-fire the routine manually via `update_scheduled_task` with a `fireAt` in the near future, OR run a Claude session interactively and execute the SKILL.md steps yourself. After firing once via `fireAt`, restore the recurring schedule with `update_scheduled_task` + `cronExpression: "0 21 * * *"` and `enabled: true` (a one-time fire auto-disables the task).

This is a routine-runner issue, not a prompt issue — the prompt itself is fine when run by an interactive session with the same tool set.

## Managing routines

All routine state lives under `~/.claude/scheduled-tasks/<taskId>/SKILL.md`. Use the MCP tools — don't edit files by hand unless you have to.

- **List:** `mcp__scheduled-tasks__list_scheduled_tasks` — shows IDs, schedules, next run time, and the path to each `SKILL.md`.
- **Edit:** `mcp__scheduled-tasks__update_scheduled_task` with the `taskId` and any subset of `prompt`, `cronExpression`, `description`, `enabled`, `notifyOnCompletion`.
- **Pause:** `update_scheduled_task` with `enabled: false`. Resume with `enabled: true`.
- **Run manually:** open the "Scheduled" section in the Claude Code sidebar and click "Run now" on the task — useful for pre-approving any tool permissions before the first automatic run.

## Adding a new routine

Use `mcp__scheduled-tasks__create_scheduled_task`. The prompt must be fully self-contained — list every MCP tool the routine should call, spell out the output format, and include the user's timezone. Each fire is a fresh Claude with no prior context.

Convention for this project: prefer MCP tool calls (`mcp__tempo-mcp__*`) for any app data operations. Never write SQL from a routine.
