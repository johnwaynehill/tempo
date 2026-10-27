# gcal-sync-cron

Tiny Railway cron service that triggers Tempo's Google Calendar sync.

## What it does

Twice a day, POSTs to `${API_URL}/api/internal/google-sync` with the shared
secret. The API does the real work: iterating over every connection with
`sync_enabled = true` and mirroring each user's primary Google calendar into
`calendar_events` (see `api/src/lib/google-calendar.ts`).

The container is single-purpose — it `curl`s, prints the response, exits.

## Setup

The service's settings live in `.railway/railway.ts` (service `gcal-sync-cron`):
the repo as its source with root directory `/`, the Dockerfile at
`api/cron-gcal-sync/Dockerfile`, restart policy `NEVER`, and the schedule
`0 13,1 * * *`. That's **13:00 and 01:00 UTC**, roughly **06:00 and 18:00
Pacific** (morning and evening). A little drift around DST is fine, because the
sync is idempotent. Change any of them there and run `railway config plan`, then
`railway config apply`.

Its variables are set on Railway, not in the repo:
- `API_URL` = `https://tempo-api-production.up.railway.app`
- `GOOGLE_SYNC_SECRET` = the same value set on the `tempo-api` service

A cron runs with the variables from its last deploy, so redeploy it after
changing one. Runs appear in the service's deployments tab, and the Railway
dashboard's "Run Now" button triggers one by hand.

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
