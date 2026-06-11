# Google Calendar sync

One-way sync: a user's Google Calendar events are mirrored **into** Tempo's
calendar as read-only entries. Google stays the source of truth — Tempo never
writes back. A cron service re-syncs a couple of times a day.

This is being built in phases. **Phase 1 (this doc's current scope) is the
OAuth account link only** — connecting an account stores tokens but does not yet
import events. Later phases add the sync engine, read-only rendering in the
calendar UI, and the scheduled cron.

## Architecture

| Piece | Location |
|-------|----------|
| Token storage | `google_calendar_connections` table (`api/src/db/schema.ts`) |
| Token encryption | `api/src/lib/crypto.ts` (AES-256-GCM) |
| OAuth client | `api/src/lib/google-oauth.ts` (plain `fetch`, no `googleapis` dep) |
| Endpoints | `api/src/routes/google-calendar.ts` |

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/google-calendar/status` | user | Connection state for the Settings UI |
| `GET` | `/api/google-calendar/connect` | user | Returns the Google consent URL (`{ url }`) |
| `GET` | `/api/google-calendar/callback` | **public** | Google redirects here post-consent; stores tokens, redirects to `${APP_URL}/settings?google=<status>` |
| `DELETE` | `/api/google-calendar` | user | Revoke at Google + drop the connection |

The callback is mounted **before** the `/api` auth chain in `index.ts` because
Google redirects the browser to it with no Authorization header. A one-time,
10-minute `state` value (stored in `mcp_oauth_state`) ties the anonymous
callback back to the user who started the flow.

`?google=<status>` values the Settings UI may receive: `connected`, `denied`,
`expired`, `no_refresh_token`, `error`.

## One-time setup

### 1. Google Cloud Console

1. Create / pick a project at <https://console.cloud.google.com>.
2. **APIs & Services → Library** → enable the **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → configure (External; add your
   own Google account as a test user while unverified). Add the scope
   `https://www.googleapis.com/auth/calendar.readonly`.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI:
     `https://<api-host>/api/google-calendar/callback`
     (e.g. `https://tempo-api-production.up.railway.app/api/google-calendar/callback`)
     — and `http://localhost:3001/api/google-calendar/callback` for local dev.
5. Copy the **Client ID** and **Client secret**.

### 2. Environment variables (API service)

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://<api-host>/api/google-calendar/callback
TOKEN_ENCRYPTION_KEY=<64 hex chars>      # openssl rand -hex 32
APP_URL=https://tempo.designbyjohnwayne.com   # where the callback redirects back to
```

If `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_OAUTH_REDIRECT_URI` or
`TOKEN_ENCRYPTION_KEY` are unset, the integration is disabled: `connect` returns
`503` and the callback redirects with `?google=error`. It never defaults to open.

### 3. Database

Run `npm --prefix api run db:push` (or apply
`Docs/migrations/2026-06-09-google-calendar-sync.sql`) before deploying.
