/**
 * Recurrence: the next occurrence of a repeating todo. Server-side port of
 * `src/lib/recurrence.ts`, with one difference — the browser did its calendar
 * math in the user's local timezone for free, so here every step is anchored
 * to an explicit IANA zone and the result is midnight in that zone (which is
 * how the web client has always stored due dates).
 *
 * Pure: no database, no Express.
 */

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly'
  /** 0 = Sunday … 6 = Saturday (weekly). */
  days_of_week?: number[]
  /** 1–31 (monthly). */
  day_of_month?: number
}

interface Ymd {
  y: number
  m: number // 1–12
  d: number
}

function partsIn(zone: string, date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const out: Record<string, string> = {}
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value
  return out
}

/** Calendar date of `date` as seen in `zone`. */
export function ymdInZone(date: Date, zone: string): Ymd {
  const p = partsIn(zone, date)
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) }
}

/** Minutes east of UTC that `zone` is at the given instant. */
function offsetMinutes(zone: string, instant: Date): number {
  const p = partsIn(zone, instant)
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second))
  return Math.round((asUtc - instant.getTime()) / 60000)
}

/** The instant that is 00:00 on the given calendar date in `zone`. */
export function zonedMidnight({ y, m, d }: Ymd, zone: string): Date {
  const guess = Date.UTC(y, m - 1, d)
  // One correction is enough except in the hour a DST change lands on midnight.
  const first = new Date(guess - offsetMinutes(zone, new Date(guess)) * 60000)
  return new Date(guess - offsetMinutes(zone, first) * 60000)
}

/** Day-of-week (0 = Sunday) of a calendar date; pure arithmetic via UTC. */
function weekday({ y, m, d }: Ymd): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function addDays({ y, m, d }: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/**
 * Next occurrence after `fromDate` (the current due date, or today), as
 * midnight in `zone`. Mirrors the web client exactly: daily is +1, weekly is
 * the next listed weekday (or +7 with no list), monthly is the same day next
 * month clamped to that month's length.
 */
export function getNextOccurrence(rule: RecurrenceRule, fromDate: Date, zone: string): Date {
  const from = ymdInZone(fromDate, zone)
  let next: Ymd

  switch (rule.frequency) {
    case 'daily':
      next = addDays(from, 1)
      break

    case 'weekly': {
      const days = rule.days_of_week
      if (!days || days.length === 0) {
        next = addDays(from, 7)
      } else {
        const current = weekday(from)
        const sorted = [...days].sort((a, b) => a - b)
        const upcoming = sorted.find((d) => d > current)
        next = upcoming !== undefined
          ? addDays(from, upcoming - current)
          : addDays(from, 7 - current + sorted[0])
      }
      break
    }

    case 'monthly': {
      const targetDay = rule.day_of_month ?? from.d
      const y = from.m === 12 ? from.y + 1 : from.y
      const m = from.m === 12 ? 1 : from.m + 1
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
      next = { y, m, d: Math.min(targetDay, lastDay) }
      break
    }
  }

  return zonedMidnight(next, zone)
}

export function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  if (!value || typeof value !== 'object') return false
  const f = (value as { frequency?: unknown }).frequency
  return f === 'daily' || f === 'weekly' || f === 'monthly'
}
