-- Projects: enforce unique (user_id, name) per user.
--
-- Fixes schema drift: api/src/db/schema.ts has defined
-- `unique().on(table.userId, table.name)` on the projects table (constraint
-- projects_user_id_name_unique), but the constraint was never applied to the
-- production Postgres database.
--
-- Discovered 2026-06-09 when `npm --prefix api run db:push` detected the missing
-- constraint and offered to TRUNCATE the projects table. We deliberately do NOT
-- use db:push here — it bundles all pending schema drift into one interactive,
-- potentially destructive sync. This targeted migration applies only the
-- constraint.
--
-- Preconditions verified before running (2026-06-13): zero duplicate
-- (user_id, name) groups in production —
--   SELECT user_id, name, count(*) FROM projects
--   GROUP BY user_id, name HAVING count(*) > 1;  -- returned 0 rows
-- so ADD CONSTRAINT succeeds without any dedupe step.
--
-- Reversible: DROP CONSTRAINT projects_user_id_name_unique.
-- Idempotent guard via DO block — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_user_id_name_unique'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_user_id_name_unique UNIQUE (user_id, name);
  END IF;
END $$;
