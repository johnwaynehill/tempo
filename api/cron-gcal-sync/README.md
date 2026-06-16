# gcal-sync-cron

Tiny Railway cron service that triggers Tempo's Google Calendar sync.

## What it does

Twice a day, POSTs to `${API_URL}/api/internal/google-sync` with the shared
secret. The API does the real work: iterating over every connection with
`sync_enabled = true` and mirroring each user's primary Google calendar into
`calendar_events` (see `api/src/lib/google-calendar.ts`).

The container is single-purpose — it `curl`s, prints the response, exits.

## Setup (one-time)

1. In the Railway dashboard, **create a new service in the existing Tempo project**:
   - Source: the same GitHub repo
   - **Root directory: `/`** (the repo root — Railway reads
     `api/cron-gcal-sync/railway.json`, whose `dockerfilePath` is resolved from
     the root). Do **not** point the root directory at the `railway.json` file.
   - Service name: `gcal-sync-cron`

2. Point Railway at this service's config file so it picks up the cron schedule
   and Dockerfile:
   - **Settings → Config-as-Code** (a.k.a. "Railway Config File") → set to
     `api/cron-gcal-sync/railway.json`

   > **Build fails with `stat .../railway.json: not a directory`?** The Root
   > Directory was set to the `railway.json` *file* instead of `/`. Fix step 1's
   > Root directory to `/` and put the config path in step 2's field instead.

3. **Set environment variables** on this service:
   - `API_URL` = `https://tempo-api-production.up.railway.app`
   - `GOOGLE_SYNC_SECRET` = same value set on the `tempo-api` service

4. **Confirm the cron schedule** under Settings → Cron Schedule.
   The schedule baked into `railway.json` is `0 13,1 * * *` — **13:00 and 01:00
   UTC**, i.e. roughly **06:00 and 18:00 Pacific** (morning + evening). A small
   window of clock drift around DST is fine; the sync is idempotent.

5. Deploy. First run appears in the service's deployments tab. Manual triggers
   are available via the "Run Now" button in the Railway dashboard.

## Why a separate service?

Railway cron jobs replace the service's long-running process with one-shot runs
on the schedule. The API service must stay long-running, so the cron lives in
its own image. (Same pattern as `api/cron-autoplan/`.)

## Testing

```bash
# From your laptop, with GOOGLE_SYNC_SECRET in your shell:
curl -X POST \
  -H "X-Google-Sync-Secret: $GOOGLE_SYNC_SECRET" \
  https://tempo-api-production.up.railway.app/api/internal/google-sync

# Sync a single user (testing):
curl -X POST \
  -H "X-Google-Sync-Secret: $GOOGLE_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uid>"}' \
  https://tempo-api-production.up.railway.app/api/internal/google-sync
```
