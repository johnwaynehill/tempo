-- Google Calendar: several Google accounts per Tempo user.
--
-- google_calendar_connections was keyed by user_id (one Google account per user).
-- It gets its own id as the primary key, so a user can have one row per Google
-- account (unique on user_id + google_email).
--
-- calendar_events gets connection_id, the Google account a synced event came from.
-- Synced events are now unique per (user_id, connection_id, external_id): the same
-- meeting on two connected accounts often has the same Google event id, which
-- collided under the old (user_id, external_id) index. Deleting a connection
-- deletes its events (ON DELETE CASCADE). Existing synced events are attached to
-- the user's existing connection.
--
-- Run BEFORE deploying the API change; the old code's upsert relies on the index
-- this drops, so deploy right after (a sync in between fails and is retried at
-- the next cron run). Idempotent: safe to re-run.
-- NOTE: apply this file directly (do NOT use `db:push` on this project).

ALTER TABLE google_calendar_connections
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'google_calendar_connections'::regclass
      AND conname = 'google_calendar_connections_pkey'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (user_id)'
  ) THEN
    ALTER TABLE google_calendar_connections DROP CONSTRAINT google_calendar_connections_pkey;
    ALTER TABLE google_calendar_connections ADD CONSTRAINT google_calendar_connections_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS google_calendar_connections_user_idx
  ON google_calendar_connections (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_connections_user_email_unique
  ON google_calendar_connections (user_id, google_email);

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS connection_id uuid
    REFERENCES google_calendar_connections (id) ON DELETE CASCADE;

UPDATE calendar_events e
SET connection_id = c.id
FROM google_calendar_connections c
WHERE e.source = 'google' AND e.connection_id IS NULL AND c.user_id = e.user_id;

DROP INDEX IF EXISTS calendar_events_user_external_unique;
CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_user_connection_external_unique
  ON calendar_events (user_id, connection_id, external_id);
