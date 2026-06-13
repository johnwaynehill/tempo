-- Google Calendar sync (Phase 2): event source columns.
--
-- Adds source / external_id / etag to calendar_events so events mirrored from
-- Google can be distinguished from native Tempo events and upserted by
-- (user_id, external_id). Native events default to source='tempo'.
--
-- The unique index is the upsert target for the sync engine. Native rows have
-- NULL external_id; Postgres treats NULLs as distinct, so they never collide.
--
-- Run BEFORE deploying the API change. Additive and idempotent — safe to re-run.
-- NOTE: apply this file directly (do NOT use `db:push` on this project — it
-- bundles unrelated schema drift and will prompt to truncate the projects table).

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS source      text NOT NULL DEFAULT 'tempo',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS etag        text;

CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_user_external_unique
  ON calendar_events (user_id, external_id);
