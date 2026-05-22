-- Morning auto-plan: server-side daily Today pre-fill.
--
-- Adds three columns to user_preferences:
--   autoplan_enabled        — opt-in toggle (default false; safety)
--   autoplan_timezone       — IANA tz used to compute "today" per user
--   autoplan_last_run_date  — guards against duplicate cron triggers in one day
--
-- Run BEFORE deploying the API change. Idempotent — safe to re-run.
--
-- Standard project convention is `npm --prefix api run db:push`, which will
-- detect these columns from the updated schema in api/src/db/schema.ts and
-- apply them. This file exists as a backup / for manual operators.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS autoplan_enabled       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autoplan_timezone      text    NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS autoplan_last_run_date text;
