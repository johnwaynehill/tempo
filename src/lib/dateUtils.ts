/** Get start of day (midnight) for a date */
export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Get end of day (23:59:59.999) for a date */
export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Get start of week (Monday) for a date */
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // JS: Sunday=0, Monday=1, ..., Saturday=6
  // We want Monday as start: shift Sunday (0) to -6, others to (1-day)
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Get end of week (Sunday 23:59:59) for a date */
export function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

/** Get week range { start: Monday, end: Sunday } for a date */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  return { start: getStartOfWeek(date), end: getEndOfWeek(date) }
}

/** Get month range for a date */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** Check if two dates are the same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Generate an array of dates for each day in a range (inclusive) */
export function eachDayOfRange(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const current = startOfDay(start)
  const last = startOfDay(end)
  while (current <= last) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return days
}

/** Format a week range label, e.g. "Mar 24 - Mar 30, 2026" */
export function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)

  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const year = end.getFullYear()

  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} - ${end.getDate()}, ${year}`
  }
  return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${end.getDate()}, ${year}`
}

/** Format a date as ISO date string (YYYY-MM-DD) */
export function toISODateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Day name abbreviation (Mon, Tue, etc.) */
export function dayAbbrev(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

/** Full day name (Monday, Tuesday, etc.) */
export function dayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}
