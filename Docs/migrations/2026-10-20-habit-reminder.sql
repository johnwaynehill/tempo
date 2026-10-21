-- Daily habit reminder: one push a day, at a time the user picks, when habits are still open.
--
-- Adds three columns to user_preferences:
--   habit_reminder_enabled    — off by default
--   habit_reminder_time       — "HH:MM" local wall-clock (in autoplan_timezone), default 20:00
--   habit_reminder_last_date  — server-managed: the local date it last went out ("2026-10-20"),
--                               so it's sent once a day even with two API instances sweeping
--
-- Run BEFORE deploying the API change. Additive and idempotent — safe to re-run.
-- NOTE: apply this file directly (do NOT use `db:push` on this project — it
-- bundles unrelated schema drift and will prompt to truncate the projects table).

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS habit_reminder_enabled   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS habit_reminder_time      text    NOT NULL DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS habit_reminder_last_date text;
