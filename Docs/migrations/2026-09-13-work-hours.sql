-- Time visibility, phase 3: working hours for overcommitment detection.
--
-- Adds two columns to user_preferences:
--   work_day_start  — "HH:MM" local wall-clock, default 09:00
--   work_day_end    — "HH:MM" local wall-clock, default 17:00
--
-- The client compares the minutes still planned on Today against the free time
-- between max(now, work_day_start) and work_day_end, minus timed calendar events.
--
-- Run BEFORE deploying the API change. Additive and idempotent — safe to re-run.
-- NOTE: apply this file directly (do NOT use `db:push` on this project — it
-- bundles unrelated schema drift and will prompt to truncate the projects table).

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS work_day_start text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS work_day_end   text NOT NULL DEFAULT '17:00';
