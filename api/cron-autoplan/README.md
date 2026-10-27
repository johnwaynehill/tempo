# autoplan-cron

Tiny Railway cron service that triggers Tempo's morning auto-plan.

## What it does

Once a day, POSTs to `${API_URL}/api/internal/autoplan` with the shared secret.
The API does the real work: iterating over users with `autoplan_enabled = true`
and replacing each user's Today view with 3–5 AI-picked todos.

The container is single-purpose — it `curl`s, prints the response, exits.

## Setup

The service's settings live in `.railway/railway.ts` (service `autoplan-cron`):
the Dockerfile, restart policy `NEVER`, and the schedule `30 13 * * *`, which is
**13:30 UTC**: 06:30 Pacific in summer (PDT) and 05:30 in winter (PST), both
before 7:30 AM. Change any of them there and run `railway config plan`, then
`railway config apply`.

It isn't linked to the repo, so a push never redeploys it. Deploy it from this
folder, where its Dockerfile is at the root of the upload:

```bash
cd api/cron-autoplan && railway up --service autoplan-cron
```

Its variables are set on Railway, not in the repo:
- `API_URL` = `https://tempo-api-production.up.railway.app`
- `AUTOPLAN_SECRET` = the same value set on the `tempo-api` service

A cron runs with the variables from its last deploy, so redeploy it after
changing one (`railway redeploy --service autoplan-cron -y`). The Railway
dashboard's "Run Now" button triggers a run by hand.

## Why a separate service?

Railway cron jobs replace the service's long-running process with one-shot
runs on the schedule. The API service must stay long-running, so the cron
lives in its own image.

## Testing

```bash
# From your laptop, with AUTOPLAN_SECRET in your shell:
curl -X POST \
  -H "X-Autoplan-Secret: $AUTOPLAN_SECRET" \
  https://tempo-api-production.up.railway.app/api/internal/autoplan

# Force-run for a single user (bypasses the per-day idempotency check):
curl -X POST \
  -H "X-Autoplan-Secret: $AUTOPLAN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uid>","timezone":"America/Los_Angeles","force":true}' \
  https://tempo-api-production.up.railway.app/api/internal/autoplan
```
