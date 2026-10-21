# Push notifications

Tempo sends four kinds of notification to the iOS app:

| Kind | Sent by | When |
|---|---|---|
| **Reminder** | Server (APNs) | A todo's `reminder_at` arrives, whichever client set it (web, iOS, Claude via MCP). |
| **Morning plan ready** | Server (APNs) | The 06:30 auto-plan fills Today: "4 tasks, about 2h 30m." |
| **Habit reminder** | Server (APNs) | Once a day at the time set in Settings, if any of today's habits are still open: "Last habit to go: Stretch" or "Did you get to those habits today?" |
| **Timer running long** | The phone (local) | The task on the clock passes its estimate by a quarter of it, at least 10 minutes. |

The timer nudge is local because the running timer only exists on the phone; it's
rescheduled on every start, pause, resume and stop.

## How reminders avoid arriving twice

Before push, the app scheduled every reminder as a local notification. Now:

- Once the server has this device's token (`PUT /api/push/devices` succeeded),
  `PushRegistration.isActive` is true and `ReminderScheduler` schedules **no** local
  reminders. The server owns them.
- If notifications aren't allowed, APNs refuses to register, or the upload fails
  (offline, or an API that doesn't have the route yet), it stays false and local
  reminders carry on as before.
- On the server a sweep every 30 s claims due reminders with one
  `UPDATE … SET reminder_pushed_at = now() … RETURNING`, so each goes out once even
  with two API instances. It only claims reminders for users with a registered device
  and skips ones more than 15 minutes late (a deploy gap), so a restart can't send a
  burst of stale ones. Changing `reminder_at` clears `reminder_pushed_at`.
- Reminder text matches the app's local reminders exactly (same four phrasings, same
  pick per todo id).

## Habit reminder

Off by default; turned on (with a time) in Settings on iOS or the web. The same 30 s sweep
checks it: once the user's local time (in `autoplan_timezone`) reaches the chosen time, it
claims the day by setting `user_preferences.habit_reminder_last_date` with a conditional
`UPDATE … RETURNING` (so two API instances can't both send it), then sends only if at least
one unarchived habit isn't completed for that local date. Up to 60 minutes late is still
sent (a deploy in between); later than that, the day is skipped. The wording rotates one
step a day through four phrasings for one open habit and four for several (at most three
named, then "and 2 more"), so consecutive days never read the same. There's no local
fallback: without a registered device it isn't sent.

Tapping a reminder or nudge opens that todo on Today; tapping "plan ready" opens Today;
tapping the habit reminder opens Habits.
Signing out unregisters the device.

## Setup (one time)

1. **Database.** Apply `Docs/migrations/2026-10-16-push-notifications.sql` to prod
   **before** deploying the API. `PUT /api/todos/:id` writes the new
   `reminder_pushed_at` column, so the API code must not reach prod first. Do not use
   `db:push`.
2. **APNs key.** developer.apple.com → Certificates, Identifiers & Profiles → Keys → +,
   enable *Apple Push Notifications service (APNs)*, download the `.p8` (once only).
   Note the Key ID and your Team ID.
3. **Railway env on `tempo-api`:** `APNS_KEY` (the `.p8` contents; `\n` escapes are
   fine), `APNS_KEY_ID`, `APNS_TEAM_ID`, optionally `APNS_BUNDLE_ID`
   (default `com.johnwaynehill.Tempo`). Without these the API sends nothing and logs
   `APNs not configured`; everything else works.
4. **App signing.** The app now has the Push Notifications capability
   (`aps-environment` in `ios/project.yml`), which a free personal team can't sign.
   Set `DEVELOPMENT_TEAM` in `ios/project.yml` to the paid team's ID, run
   `xcodegen generate`, and register the bundle ID with Push enabled (Xcode's automatic
   signing does this on the first device build).

Debug builds register as `sandbox`, release builds as `production`; the server sends
each token to the matching APNs host.

## Testing

- `xcrun simctl push <device> com.johnwaynehill.Tempo payload.json` delivers a payload
  to the simulator without APNs (the payload shape is `apnsPayload()` in
  `api/src/lib/apns.ts`).
- A real end-to-end test needs a device: set a reminder a few minutes out on the web,
  close the app, and wait.
