#!/bin/sh
# Cron-trigger script: POSTs to the Google Calendar sync endpoint, fails the run
# on non-2xx.
#
# Logs include the response body so Railway's deployment log surfaces the
# per-user sync summary (events upserted/pruned) for that run.
set -e

: "${API_URL:?API_URL must be set on the cron service}"
: "${GOOGLE_SYNC_SECRET:?GOOGLE_SYNC_SECRET must be set on the cron service}"

echo "[gcal-sync-cron] POST ${API_URL}/api/internal/google-sync at $(date -u +%FT%TZ)"

# -f makes curl exit non-zero on 4xx/5xx
# -sS keeps it quiet but still prints errors
# -w prints status + total time after the body
curl -fsS \
  -X POST \
  -H "X-Google-Sync-Secret: ${GOOGLE_SYNC_SECRET}" \
  -H "Content-Type: application/json" \
  -w "\n[gcal-sync-cron] HTTP %{http_code} in %{time_total}s\n" \
  "${API_URL}/api/internal/google-sync"
