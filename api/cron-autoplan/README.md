# autoplan-cron

Tiny Railway cron service that triggers Tempo's morning auto-plan.

## What it does

Once a day, POSTs to `${API_URL}/api/internal/autoplan` with the shared secret.
The API does the real work: iterating over users with `autoplan_enabled = true`
and replacing each user's Today view with 3–5 AI-picked todos.

The container is single-purpose — it `curl`s, prints the response, exits.

## Setup (one-time)

1. In the Railway dashboard, **create a new service in the existing Tempo project**:
   - Source: the same GitHub repo
   - Root directory: `/` (Railway reads `api/cron-autoplan/railway.json` for build)
   - Service name: `autoplan-cron`

2. Override the root config path so Railway picks this service's `railway.json`:
   - **Settings → Config-as-Code** → set to `api/cron-autoplan/railway.json`

3. **Set environment variables** on this service:
   - `API_URL` = `https://tempo-api-production.up.railway.app`
   - `AUTOPLAN_SECRET` = same value you set on the `tempo-api` service

4. **Confirm the cron schedule** under Settings → Cron Schedule.
   The schedule baked into `railway.json` is `30 13 * * *` — **13:30 UTC = 06:30 PT**
   (PDT in summer). In winter when PT moves to PST (UTC-8), this becomes 05:30 PT,
   which is still well before 7:30 AM as required. Adjust if needed.

5. Deploy. First run will appear in the service's deployments tab. Manual
   triggers are available via the "Run Now" button in the Railway dashboard.

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
