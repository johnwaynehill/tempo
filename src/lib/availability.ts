/**
 * Overcommitment detection: does the planned work fit in the hours left today?
 * Pure functions only, so they can be exercised from a script without React.
 */
import { toISODateString } from '@/lib/dateUtils'
import { remainingMinutes, formatMinutes, formatClock } from '@/lib/time'
import type { Estimable, TimerSnapshot } from '@/lib/time'

export interface BusyBlock {
  start_time: Date
  end_time: Date
  all_day: boolean
}

export interface Availability {
  windowStart: Date
  windowEnd: Date
  /** Minutes between max(now, day start) and day end; 0 once the day is over. */
  windowMinutes: number
  /** Minutes of timed events inside the window, overlaps merged. */
  busyMinutes: number
  freeMinutes: number
}

export const DEFAULT_WORK_DAY_START = '09:00'
export const DEFAULT_WORK_DAY_END = '17:00'

/** Only nag when the gap is bigger than rounding noise. */
export const OVERCOMMIT_THRESHOLD_MINUTES = 30

/** "09:00" → the same wall-clock time on `day`, or null when the string is malformed. */
export function clockOnDay(day: Date, hhmm: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d
}

function mergedBusyMinutes(events: BusyBlock[], windowStart: Date, windowEnd: Date): number {
  // All-day events are stored at noon UTC and are not blocking time.
  const blocks = events
    .filter((e) => !e.all_day)
    .map((e) => ({
      start: Math.max(e.start_time.getTime(), windowStart.getTime()),
      end: Math.min(e.end_time.getTime(), windowEnd.getTime()),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start)

  let total = 0
  let current: { start: number; end: number } | null = null
  for (const block of blocks) {
    if (current && block.start <= current.end) {
      current.end = Math.max(current.end, block.end)
    } else {
      if (current) total += current.end - current.start
      current = { ...block }
    }
  }
  if (current) total += current.end - current.start
  return Math.round(total / 60000)
}

export function computeAvailability({
  now,
  dayStart,
  dayEnd,
  events,
}: {
  now: Date
  dayStart: string
  dayEnd: string
  events: BusyBlock[]
}): Availability {
  const start = clockOnDay(now, dayStart) ?? clockOnDay(now, DEFAULT_WORK_DAY_START)!
  const end = clockOnDay(now, dayEnd) ?? clockOnDay(now, DEFAULT_WORK_DAY_END)!
  const windowStart = new Date(Math.max(now.getTime(), start.getTime()))
  const windowEnd = end

  if (windowEnd.getTime() <= windowStart.getTime()) {
    return { windowStart, windowEnd, windowMinutes: 0, busyMinutes: 0, freeMinutes: 0 }
  }

  const windowMinutes = Math.round((windowEnd.getTime() - windowStart.getTime()) / 60000)
  const busyMinutes = mergedBusyMinutes(events, windowStart, windowEnd)
  return {
    windowStart,
    windowEnd,
    windowMinutes,
    busyMinutes,
    freeMinutes: Math.max(0, windowMinutes - busyMinutes),
  }
}

/** Planned minus free; positive means the plan doesn't fit. */
export function overcommitMinutes(availability: Availability, plannedMinutes: number): number {
  return plannedMinutes - availability.freeMinutes
}

const roundTo5 = (mins: number) => Math.round(mins / 5) * 5

/**
 * One gentle sentence when the plan overruns the free time by more than the
 * threshold; null when it fits, when the gap is small, or once the day is over.
 */
export function overcommitMessage(availability: Availability, plannedMinutes: number): string | null {
  if (availability.windowMinutes <= 0) return null
  if (overcommitMinutes(availability, plannedMinutes) <= OVERCOMMIT_THRESHOLD_MINUTES) return null

  const planned = formatMinutes(plannedMinutes)
  const free = roundTo5(availability.freeMinutes)
  const until = formatClock(availability.windowEnd)
  const room = free > 0 ? `roughly ${formatMinutes(free)} free before ${until}` : `no time free before ${until}`
  return `About ${planned} planned, and ${room}. Want to move something to tomorrow?`
}

/**
 * The whole check for a page: today's timed events, the working-hours window,
 * and the minutes still planned. `timer` narrows the active task to what's left
 * of its estimate; pass null when nothing is running.
 */
export function todayOvercommitMessage({
  todos,
  timer,
  events,
  dayStart,
  dayEnd,
  now = new Date(),
}: {
  todos: (Estimable & { id: string })[]
  timer: TimerSnapshot | null
  events: BusyBlock[]
  dayStart: string
  dayEnd: string
  now?: Date
}): string | null {
  if (todos.length === 0) return null
  const todayKey = toISODateString(now)
  const todaysEvents = events.filter((e) => toISODateString(e.start_time) === todayKey)
  const availability = computeAvailability({ now, dayStart, dayEnd, events: todaysEvents })
  return overcommitMessage(availability, remainingMinutes(todos, timer))
}
