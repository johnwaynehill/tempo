import { and, asc, eq, gt, inArray, isNull, lte, ne, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { localDate, localMinutes } from './ai-pricing.js'
import { apnsConfigured, sendApns, type ApnsEnvironment, type ApnsNotification } from './apns.js'

// Who gets which push, and when (Docs/PushNotifications.md). APNs plumbing is in apns.ts.

/** Mirrors `GENTLE_MESSAGES` in the web's useReminderScheduler.ts and the iOS ReminderScheduler. */
const REMINDER_PHRASINGS: ((title: string) => string)[] = [
  (t) => `Hey, you had this on your list: ${t}`,
  (t) => `Gentle nudge: ${t}`,
  (t) => `Whenever you're ready: ${t}`,
  (t) => `Still on your radar? ${t}`,
]

/**
 * Same phrasing for the same todo everywhere: the sum of the UUID's 16 bytes picks it,
 * exactly as the iOS app's local reminders do, so a reminder reads the same whichever path
 * delivered it.
 */
export function reminderBody(todoId: string, title: string): string {
  const hex = todoId.replace(/-/g, '')
  let sum = 0
  for (let i = 0; i + 1 < hex.length; i += 2) sum += parseInt(hex.slice(i, i + 2), 16)
  return REMINDER_PHRASINGS[sum % REMINDER_PHRASINGS.length](title)
}

/**
 * Sends to every device the user has registered. Tokens APNs says are dead are forgotten.
 * Never throws; returns how many devices accepted it.
 */
export async function sendToUser(userId: string, notification: ApnsNotification): Promise<number> {
  if (!apnsConfigured()) return 0
  try {
    const devices = await db.select().from(schema.pushDevices).where(eq(schema.pushDevices.userId, userId))
    let delivered = 0
    for (const device of devices) {
      const result = await sendApns(device.token, device.environment as ApnsEnvironment, notification)
      if (result.ok) {
        delivered += 1
      } else {
        console.warn(`[push] ${device.environment} send failed for ${userId}: ${result.status} ${result.reason}`)
        if (result.gone) await db.delete(schema.pushDevices).where(eq(schema.pushDevices.token, device.token))
      }
    }
    return delivered
  } catch (err) {
    console.error('[push] sendToUser failed:', err)
    return 0
  }
}

/** `getEstimate` / `formatMinutes` from the web's src/lib/time.ts, for push copy. */
function estimateMinutes(t: { estimatedMinutes: number | null; size: string | null }): number {
  if (t.estimatedMinutes != null) return t.estimatedMinutes
  switch (t.size) {
    case 'small': return 15
    case 'medium': return 30
    case 'large': return 60
    default: return 25
  }
}

function formatMinutes(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins}m`
}

/** "Your plan for today is ready: 4 tasks, about 2h 30m." after the morning auto-plan. */
export async function sendPlanReady(userId: string, todoIds: string[]): Promise<void> {
  if (!apnsConfigured() || todoIds.length === 0) return
  try {
    const picked = await db
      .select({ estimatedMinutes: schema.todos.estimatedMinutes, size: schema.todos.size })
      .from(schema.todos)
      .where(and(eq(schema.todos.userId, userId), inArray(schema.todos.id, todoIds)))
    const total = picked.reduce((sum, t) => sum + estimateMinutes(t), 0)
    const n = picked.length
    await sendToUser(userId, {
      title: 'Your plan for today is ready',
      body: `${n} task${n === 1 ? '' : 's'}, about ${formatMinutes(total)}.`,
      threadId: 'plan',
      collapseId: 'plan-ready',
      data: { kind: 'plan' },
    })
  } catch (err) {
    console.error('[push] plan-ready failed:', err)
  }
}

/** A reminder this late when first seen (a deploy gap, an outage) is dropped, not sent. */
const REMINDER_GRACE_MS = 15 * 60_000

/**
 * Claims every reminder that's due and sends it. The claim is one UPDATE … RETURNING, so a
 * reminder goes out once even if two API instances sweep at the same moment, and only for
 * users with a registered device (everyone else still has their app's local reminders).
 */
export async function dispatchDueReminders(now = new Date()): Promise<number> {
  const due = await db
    .update(schema.todos)
    .set({ reminderPushedAt: now })
    .where(and(
      lte(schema.todos.reminderAt, now),
      gt(schema.todos.reminderAt, new Date(now.getTime() - REMINDER_GRACE_MS)),
      isNull(schema.todos.reminderPushedAt),
      ne(schema.todos.status, 'done'),
      inArray(schema.todos.userId, db.select({ userId: schema.pushDevices.userId }).from(schema.pushDevices)),
    ))
    .returning({ id: schema.todos.id, userId: schema.todos.userId, title: schema.todos.title })

  for (const todo of due) {
    await sendToUser(todo.userId, {
      title: todo.title,
      body: reminderBody(todo.id, todo.title),
      threadId: 'reminders',
      collapseId: `reminder-${todo.id}`,
      data: { kind: 'reminder', todoId: todo.id },
    })
  }
  return due.length
}

// --- Daily habit reminder: one push at the user's chosen time, only if habits are still open.

type Copy = { title: string; body: string }

/** With one habit left. The user's own example leads: "Last habit to go: Stretch". */
const ONE_LEFT: ((name: string) => Copy)[] = [
  (n) => ({ title: `Last habit to go: ${n}`, body: 'Still time to check it off today.' }),
  (n) => ({ title: 'One habit left today', body: `${n}, whenever you're ready.` }),
  (n) => ({ title: 'Almost there', body: `Just ${n} left for today.` }),
  (n) => ({ title: `${n} is still open`, body: "A quick one before the day's done?" }),
]

/** With several left; `list` is "Stretch, Read and Journal" (at most three named). */
const SEVERAL_LEFT: ((list: string, count: number) => Copy)[] = [
  (l) => ({ title: 'Did you get to those habits today?', body: `Still open: ${l}.` }),
  (l, n) => ({ title: 'Quick habit check-in', body: `${n} still open: ${l}.` }),
  (l) => ({ title: "Habits, before the day's done", body: `${l} are still waiting.` }),
  (l) => ({ title: 'How did the habits go today?', body: `Still open: ${l}.` }),
]

function listNames(names: string[]): string {
  const shown = names.length > 3 ? [...names.slice(0, 3), `${names.length - 3} more`] : names
  return shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
}

/**
 * The reminder's wording for the open habits on a local date ("2026-10-20"). The phrasing
 * moves on one step each day, so consecutive days never read the same.
 */
export function habitReminderCopy(openNames: string[], date: string): Copy {
  const [y, m, d] = date.split('-').map(Number)
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
  if (openNames.length === 1) return ONE_LEFT[day % ONE_LEFT.length](openNames[0])
  return SEVERAL_LEFT[day % SEVERAL_LEFT.length](listNames(openNames), openNames.length)
}

/** Sent up to this long after the chosen time (a deploy or restart in between); after that, skipped for the day. */
const HABIT_REMINDER_GRACE_MIN = 60

/**
 * Sends today's habit reminder to everyone whose chosen time has come (in their timezone).
 * Claiming the day is one conditional UPDATE, so it goes out once even with two API
 * instances; a day with every habit done is claimed and sends nothing.
 */
export async function dispatchHabitReminders(now = new Date()): Promise<number> {
  const prefs = schema.userPreferences
  const candidates = await db
    .select({
      userId: prefs.userId,
      time: prefs.habitReminderTime,
      timezone: prefs.autoplanTimezone,
      lastDate: prefs.habitReminderLastDate,
    })
    .from(prefs)
    .where(and(
      eq(prefs.habitReminderEnabled, true),
      inArray(prefs.userId, db.select({ userId: schema.pushDevices.userId }).from(schema.pushDevices)),
    ))

  let sent = 0
  for (const c of candidates) {
    const date = localDate(c.timezone, now)
    if (c.lastDate === date) continue
    const [h, m] = c.time.split(':').map(Number)
    const minutesLate = localMinutes(c.timezone, now) - (h * 60 + m)
    if (!(minutesLate >= 0 && minutesLate <= HABIT_REMINDER_GRACE_MIN)) continue

    const claimed = await db
      .update(prefs)
      .set({ habitReminderLastDate: date })
      .where(and(eq(prefs.userId, c.userId), or(isNull(prefs.habitReminderLastDate), ne(prefs.habitReminderLastDate, date))))
      .returning({ userId: prefs.userId })
    if (claimed.length === 0) continue

    const habits = await db
      .select({ name: schema.habits.name, completions: schema.habits.completions })
      .from(schema.habits)
      .where(and(eq(schema.habits.userId, c.userId), eq(schema.habits.archived, false)))
      .orderBy(asc(schema.habits.createdAt))
    const open = habits
      .filter((habit) => !(habit.completions as Record<string, boolean> | null)?.[date])
      .map((habit) => habit.name)
    if (open.length === 0) continue

    await sendToUser(c.userId, {
      ...habitReminderCopy(open, date),
      threadId: 'habits',
      collapseId: 'habit-reminder',
      data: { kind: 'habits' },
    })
    sent += 1
  }
  return sent
}

/** Starts the reminder sweep (every 30 s) when APNs is configured. Safe to call once at boot. */
export function startPushScheduler(intervalMs = 30_000): void {
  if (!apnsConfigured()) {
    console.log('[push] APNs not configured; reminder pushes are off')
    return
  }
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const sent = await dispatchDueReminders()
      if (sent > 0) console.log(`[push] sent ${sent} reminder(s)`)
      const habitsSent = await dispatchHabitReminders()
      if (habitsSent > 0) console.log(`[push] sent ${habitsSent} habit reminder(s)`)
    } catch (err) {
      console.error('[push] reminder sweep failed:', err)
    } finally {
      running = false
    }
  }
  setInterval(tick, intervalMs).unref()
  console.log('[push] reminder sweep started')
}
