-- Push notifications (Docs/PushNotifications.md). Additive; apply by hand to prod
-- BEFORE deploying the API that uses it. Do not use db:push on this project.

-- One row per device that can receive pushes. The APNs token is the key: a phone that
-- signs into another account moves its token to that account instead of duplicating it.
CREATE TABLE IF NOT EXISTS push_devices (
  token        text PRIMARY KEY,
  user_id      text NOT NULL,
  environment  text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  bundle_id    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_devices_user_id_idx ON push_devices (user_id);

-- When a todo's reminder was pushed, so it's sent once. Cleared when reminder_at changes.
ALTER TABLE todos ADD COLUMN IF NOT EXISTS reminder_pushed_at timestamptz;
