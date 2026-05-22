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

## First-run setup: pre-approve tool permissions

Scheduled-task sessions run unattended — there's no human to click "allow" on a permission prompt. The first time a routine tries to call a tool that requires per-use approval (e.g. `mcp__tempo-mcp__list_todos`), the session stalls waiting for the prompt and the harness eventually terminates it without making progress.

**Symptom:** `lastRunAt` is set so it looks like the run succeeded, but no work was done. Drilling into the session transcript shows the run completed only the few turns that don't trigger permission prompts (typically `thinking`, `Bash`, `ToolSearch`) and then stopped before any tool result came back.

**Fix:** before the first scheduled fire, run the routine manually in an interactive Claude session and accept each tool prompt with **"Always allow"** (or your client's equivalent). After that the autonomous schedule runs without intervention.

Observed 2026-05-21 and 2026-05-22 with `nightly-tempo-plan`: the run terminated after ~7 seconds, completing only the three pre-permission turns. Pre-approving the `tempo-mcp` tools via a manual interactive run on 2026-05-22 resolved it.

**To manually re-fire a routine** (useful for the first-run setup, or to test prompt changes):
```
mcp__scheduled-tasks__update_scheduled_task
  taskId: <id>
  fireAt: "2026-05-22T21:00:00-07:00"   # near-future ISO timestamp w/ offset
```
A `fireAt` update clears the recurring cron and auto-disables after firing, so afterward restore the schedule with:
```
mcp__scheduled-tasks__update_scheduled_task
  taskId: <id>
  cronExpression: "0 21 * * *"
  enabled: true
```

## Managing routines

All routine state lives under `~/.claude/scheduled-tasks/<taskId>/SKILL.md`. Use the MCP tools — don't edit files by hand unless you have to.

- **List:** `mcp__scheduled-tasks__list_scheduled_tasks` — shows IDs, schedules, next run time, and the path to each `SKILL.md`.
- **Edit:** `mcp__scheduled-tasks__update_scheduled_task` with the `taskId` and any subset of `prompt`, `cronExpression`, `description`, `enabled`, `notifyOnCompletion`.
- **Pause:** `update_scheduled_task` with `enabled: false`. Resume with `enabled: true`.
- **Run manually:** open the "Scheduled" section in the Claude Code sidebar and click "Run now" on the task — useful for pre-approving any tool permissions before the first automatic run.

## Adding a new routine

Use `mcp__scheduled-tasks__create_scheduled_task`. The prompt must be fully self-contained — list every MCP tool the routine should call, spell out the output format, and include the user's timezone. Each fire is a fresh Claude with no prior context.

**After creating it, do a manual fire first** to pre-approve any per-tool permission prompts (see *First-run setup* above). Routines that try to call an un-approved tool stall silently in unattended mode.

Convention for this project: prefer MCP tool calls (`mcp__tempo-mcp__*`) for any app data operations. Never write SQL from a routine.
