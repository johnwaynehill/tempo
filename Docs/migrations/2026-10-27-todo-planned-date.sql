-- Plan my week: a todo can be planned for a day of the week ahead.
--
-- Adds one column to todos:
--   planned_date — the local calendar day ("2026-10-29") the user planned to do it, or null.
--                  Not a deadline (that's due_date). On that day, auto-plan puts it on Today;
--                  before it, auto-plan leaves it alone.
--
-- Run BEFORE deploying the API change. Additive and idempotent — safe to re-run.
-- NOTE: apply this file directly (do NOT use `db:push` on this project — it
-- bundles unrelated schema drift and will prompt to truncate the projects table).

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS planned_date date;
