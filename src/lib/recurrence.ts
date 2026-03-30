import type { RecurrenceRule } from '@/types'

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Compute the next occurrence date given a recurrence rule.
 * `fromDate` is the current due date or today.
 */
export function getNextOccurrence(rule: RecurrenceRule, fromDate: Date): Date {
  const next = new Date(fromDate)
  next.setHours(0, 0, 0, 0)

  switch (rule.frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break

    case 'weekly': {
      const days = rule.days_of_week
      if (!days || days.length === 0) {
        // Default: same day next week
        next.setDate(next.getDate() + 7)
      } else {
        // Find the next matching day of week after fromDate
        const currentDay = next.getDay()
        const sorted = [...days].sort((a, b) => a - b)

        // Find first day > currentDay
        const nextDay = sorted.find((d) => d > currentDay)
        if (nextDay !== undefined) {
          next.setDate(next.getDate() + (nextDay - currentDay))
        } else {
          // Wrap to next week, pick first day
          const daysUntilNext = 7 - currentDay + sorted[0]
          next.setDate(next.getDate() + daysUntilNext)
        }
      }
      break
    }

    case 'monthly': {
      const targetDay = rule.day_of_month ?? fromDate.getDate()
      next.setMonth(next.getMonth() + 1)
      // Clamp to last day of target month
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
      next.setDate(Math.min(targetDay, lastDay))
      break
    }
  }

  return next
}

/**
 * Human-readable description of a recurrence rule.
 */
export function describeRecurrence(rule: RecurrenceRule): string {
  switch (rule.frequency) {
    case 'daily':
      return 'Every day'

    case 'weekly': {
      const days = rule.days_of_week
      if (!days || days.length === 0) return 'Every week'
      if (days.length === 7) return 'Every day'
      if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Weekdays'
      if (days.length === 2 && [0, 6].every((d) => days.includes(d))) return 'Weekends'
      return days.map((d) => DAY_NAMES_SHORT[d]).join(', ')
    }

    case 'monthly': {
      const day = rule.day_of_month
      if (!day) return 'Every month'
      const suffix = day === 1 || day === 21 || day === 31 ? 'st'
        : day === 2 || day === 22 ? 'nd'
        : day === 3 || day === 23 ? 'rd'
        : 'th'
      return `Monthly on the ${day}${suffix}`
    }
  }
}
