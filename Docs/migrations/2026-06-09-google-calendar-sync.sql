-- Google Calendar sync (Phase 1): OAuth connection storage.
--
-- Adds the google_calendar_connections table — one row per user holding the
-- (encrypted) Google OAuth tokens for a one-way Google → Tempo calendar sync.
-- Access/refresh tokens are AES-256-GCM encrypted at rest (see
-- api/src/lib/crypto.ts); this requires TOKEN_ENCRYPTION_KEY on the API service.
--
-- Run BEFORE deploying the API change. Standard project path is
-- `npm --prefix api run db:push`, which detects this table from the updated
-- schema in api/src/db/schema.ts. This file is a backup / for manual operators.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  user_id           text PRIMARY KEY,
  google_email      text,
  access_token_enc  text NOT NULL,
  refresh_token_enc text NOT NULL,
  token_expires_at  timestamptz NOT NULL,
  scope             text,
  sync_enabled      boolean NOT NULL DEFAULT true,
  sync_token        text,
  last_synced_at    timestamptz,
  last_sync_error   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
