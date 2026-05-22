#!/bin/sh
# Cron-trigger script: POSTs to the autoplan endpoint, fails the run on non-2xx.
#
# Logs include the response body so Railway's deployment log surfaces the
# per-user picks for that morning's run.
set -e

: "${API_URL:?API_URL must be set on the cron service}"
: "${AUTOPLAN_SECRET:?AUTOPLAN_SECRET must be set on the cron service}"

echo "[autoplan-cron] POST ${API_URL}/api/internal/autoplan at $(date -u +%FT%TZ)"

# -f makes curl exit non-zero on 4xx/5xx
# -sS keeps it quiet but still prints errors
# -w prints status + total time after the body
curl -fsS \
  -X POST \
  -H "X-Autoplan-Secret: ${AUTOPLAN_SECRET}" \
  -H "Content-Type: application/json" \
  -w "\n[autoplan-cron] HTTP %{http_code} in %{time_total}s\n" \
  "${API_URL}/api/internal/autoplan"
