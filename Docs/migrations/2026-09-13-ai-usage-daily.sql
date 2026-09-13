-- Daily AI spend cap: per-user, per-local-day usage totals for the Anthropic proxy.
--
-- One row per (user, day in the user's autoplan_timezone). The proxy and the
-- morning autoplan add each call's tokens and estimated USD cost here; the
-- proxy refuses new calls with 429 once cost_usd reaches AI_DAILY_CAP_USD
-- (default 2). Rows are never deleted — they're the usage history.
--
-- Run BEFORE deploying the API change. Additive and idempotent — safe to re-run.
-- NOTE: apply this file directly (do NOT use `db:push` on this project — it
-- bundles unrelated schema drift and will prompt to truncate the projects table).

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  user_id            text          NOT NULL,
  date               text          NOT NULL,           -- "YYYY-MM-DD", user-local
  requests           integer       NOT NULL DEFAULT 0,
  input_tokens       integer       NOT NULL DEFAULT 0,
  output_tokens      integer       NOT NULL DEFAULT 0,
  cache_read_tokens  integer       NOT NULL DEFAULT 0,
  cache_write_tokens integer       NOT NULL DEFAULT 0,
  cost_usd           numeric(12,6) NOT NULL DEFAULT 0,
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
