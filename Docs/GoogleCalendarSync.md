# Google Calendar sync

One-way sync: a user's Google Calendar events are mirrored **into** Tempo's
calendar as read-only entries. Google stays the source of truth — Tempo never
writes back. A cron service re-syncs a couple of times a day.

This is being built in phases. **Phases 1–3 are done:** the OAuth account link,
the sync engine, and the front-end UI (Settings connect/disconnect/"Sync now" +
read-only rendering of Google events). Remaining: the scheduled cron (Phase 4)
— until then, syncing is triggered manually via the **Sync now** button (or
`POST /api/google-calendar/sync`).

### Front-end (Phase 3)

- **Settings → Google Calendar**: Connect button (→ `connect`, redirects the
  browser to Google); once linked, shows the connected email + last-synced time,
  a **Sync now** button, and **Disconnect**. Reads the `?google=<status>`
  callback param to show a toast, then strips it from the URL.
- **Calendar**: `source='google'` events render read-only — a "Google" badge, a
  distinct dot color, no edit-on-click and no delete button (the API also 403s).
  Applies to both `src/pages/Calendar.tsx` and `src/components/backlog/CalendarView.tsx`.
- API client: `api.googleCalendar.{status,connect,sync,disconnect}` in `src/lib/api.ts`.
  `CalendarEvent` gains `source` / `external_id` in `src/types/index.ts`.

## Architecture

| Piece | Location |
|-------|----------|
| Token storage | `google_calendar_connections` table (`api/src/db/schema.ts`) |
| Token encryption | `api/src/lib/crypto.ts` (AES-256-GCM) |
| OAuth client | `api/src/lib/google-oauth.ts` (plain `fetch`, no `googleapis` dep) |
| Sync engine | `api/src/lib/google-calendar.ts` |
| Endpoints | `api/src/routes/google-calendar.ts` |

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/google-calendar/status` | user | Connection state for the Settings UI |
| `GET` | `/api/google-calendar/connect` | user | Returns the Google consent URL (`{ url }`) |
| `GET` | `/api/google-calendar/callback` | **public** | Google redirects here post-consent; stores tokens, redirects to `${APP_URL}/settings?google=<status>` |
| `POST` | `/api/google-calendar/sync` | user | Sync the primary calendar now; returns `{ status, upserted, pruned }` |
| `DELETE` | `/api/google-calendar` | user | Revoke at Google, purge mirrored events, drop the connection |

The callback is mounted **before** the `/api` auth chain in `index.ts` because
Google redirects the browser to it with no Authorization header. A one-time,
10-minute `state` value (stored in `mcp_oauth_state`) ties the anonymous
callback back to the user who started the flow.

`?google=<status>` values the Settings UI may receive: `connected`, `denied`,
`expired`, `no_refresh_token`, `error`.

### Sync engine

`syncGoogleCalendarForUser(userId)` mirrors the user's **primary** Google
calendar into `calendar_events` as read-only `source='google'` rows, over a
rolling **−7 to +90 day** window. Each run re-lists the whole window (recurring
events expanded via `singleEvents=true`) and reconciles: upsert everything
returned by `(user_id, external_id)`, then prune any `source='google'` rows not
in the result (handles deletions, cancellations, and events that aged out of the
window). It's idempotent. Access tokens are auto-refreshed from the stored
refresh token when expired.

Native Tempo events are `source='tempo'`; the events routes reject edits/deletes
to `source='google'` rows (403) and never let a client set `source`/`external_id`.

## One-time setup

### 1. Google Cloud Console

> Google replaced the old "OAuth consent screen → Configure" page with the
> **Google Auth Platform** (left-nav tabs: Overview / Branding / Audience /
> Clients / Data Access). The steps below match that current UI.

1. Create / pick a project at <https://console.cloud.google.com>.
2. **APIs & Services → Library** → enable the **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**. If the project isn't configured
   yet you'll see a **"Google Auth Platform not configured yet"** page — click
   **Get started** and complete the wizard:
   - **App Information**: app name (e.g. `Tempo`) + your support email.
   - **Audience**: **External**.
   - **Contact Information**: your email. Agree → **Create**.
4. **Data Access** tab → **Add or remove scopes** → add
   `https://www.googleapis.com/auth/calendar.readonly` → **Update** → **Save**.
5. **Audience** tab → **Test users** → **+ Add users** → add your own Google
   account.
6. **Audience** tab → **Publishing status** → **Publish app** (Production).
   ⚠️ **Do this, or background sync breaks weekly.** In *Testing* status Google
   expires refresh tokens after 7 days. Production drops that expiry. The app
   stays unverified, so the first consent shows an "unverified app" warning —
   click **Advanced → Go to Tempo (unsafe)** to proceed (fine for a single-user
   personal app).
7. **Clients** tab → **Create client** (this is where "Credentials → OAuth
   client ID" now lives):
   - Application type: **Web application**
   - Authorized redirect URIs:
     `https://<api-host>/api/google-calendar/callback`
     (e.g. `https://tempo-api-production.up.railway.app/api/google-calendar/callback`)
     — and `http://localhost:3001/api/google-calendar/callback` for local dev.
8. Copy the **Client ID** and **Client secret**.

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
