-- Time visibility, phase 2: remember how long a todo actually took.
--
-- Adds two nullable columns to todos:
--   started_at      — first time a timer was started on this todo; never overwritten
--   actual_minutes  — total timed minutes, accumulated across timer sessions,
--                     written when the timer is stopped or the todo is completed
--
-- Untimed completions leave both NULL and are excluded from calibration.
--
-- Run BEFORE deploying the API change. Additive and idempotent — safe to re-run.
-- NOTE: apply this file directly (do NOT use `db:push` on this project — it
-- bundles unrelated schema drift and will prompt to truncate the projects table).

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS started_at     timestamptz,
  ADD COLUMN IF NOT EXISTS actual_minutes integer;
