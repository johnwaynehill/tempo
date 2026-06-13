# Tiny one-shot container for the Google Calendar sync cron.
#
# Runs as a Railway "cron" service — Railway invokes CMD on the cron schedule
# instead of keeping it running. The container exits after one HTTP call.
#
# Required env (set on this Railway service):
#   API_URL            — e.g. https://tempo-api-production.up.railway.app
#   GOOGLE_SYNC_SECRET — must match the API service's GOOGLE_SYNC_SECRET
FROM curlimages/curl:8.10.1

# We want the script to fail loudly so Railway shows the cron run as failed
# on non-2xx, but we don't want to retry forever — Railway will rerun on the
# next scheduled tick anyway.
USER root
COPY run.sh /usr/local/bin/run.sh
RUN chmod +x /usr/local/bin/run.sh
USER curl_user
CMD ["/usr/local/bin/run.sh"]
