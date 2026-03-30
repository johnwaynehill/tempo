import { useMemo } from 'react'
import { toISODateString } from '@/lib/dateUtils'
import type { Habit } from '@/types'

export interface HabitStats {
  currentStreak: number
  bestStreak: number
  totalCompletions: number
  completionRate: number // 0-100
}

export interface GridCell {
  date: string
  level: 0 | 1 | 2 | 3
}

/**
 * Compute stats for a single habit.
 */
export function useHabitStats(habit: Habit): HabitStats {
  return useMemo(() => computeHabitStats(habit), [habit])
}

/**
 * Build 16-week grid data for a single habit (binary: done or not).
 */
export function useHabitGrid(habit: Habit): GridCell[] {
  return useMemo(() => {
    const cells = getLast16WeeksDates()
    return cells.map((date) => ({
      date,
      level: habit.completions[date] ? (1 as const) : (0 as const),
    }))
  }, [habit])
}

/**
 * Build 16-week grid data for all habits (aggregate: fraction of habits completed).
 */
export function useAllHabitsGrid(habits: Habit[]): GridCell[] {
  return useMemo(() => {
    if (habits.length === 0) return []
    const cells = getLast16WeeksDates()
    return cells.map((date) => {
      const completed = habits.filter((h) => h.completions[date]).length
      const ratio = completed / habits.length
      const level: 0 | 1 | 2 | 3 =
        ratio === 0 ? 0 : ratio <= 0.33 ? 1 : ratio <= 0.66 ? 2 : 3
      return { date, level }
    })
  }, [habits])
}

// --- Internals ---

function computeHabitStats(habit: Habit): HabitStats {
  const completions = habit.completions
  const totalCompletions = Object.keys(completions).length

  // Streak calculation: walk backwards from today
  const today = toISODateString(new Date())
  let currentStreak = 0
  let bestStreak = 0
  let tempStreak = 0

  // Sort all dates to find best streak
  const allDates = Object.keys(completions).sort()

  if (allDates.length > 0) {
    // Best streak: walk through sorted dates
    let prevDate = ''
    for (const date of allDates) {
      if (prevDate && isNextDay(prevDate, date)) {
        tempStreak++
      } else {
        tempStreak = 1
      }
      if (tempStreak > bestStreak) bestStreak = tempStreak
      prevDate = date
    }
  }

  // Current streak: walk backwards from today (or yesterday if today not yet done)
  {
    let checkDate = today
    if (!completions[checkDate]) {
      // Try yesterday — don't break streak if today hasn't been checked yet
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      checkDate = toISODateString(yesterday)
    }

    while (completions[checkDate]) {
      currentStreak++
      const prev = new Date(checkDate + 'T00:00:00')
      prev.setDate(prev.getDate() - 1)
      checkDate = toISODateString(prev)
    }
  }

  // Completion rate: days completed / days since creation
  const daysSinceCreation = Math.max(
    1,
    Math.ceil((Date.now() - habit.created_at.getTime()) / 86400000),
  )
  const completionRate = Math.round((totalCompletions / daysSinceCreation) * 100)

  return {
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak),
    totalCompletions,
    completionRate: Math.min(100, completionRate),
  }
}

/** Check if dateB is the day after dateA (ISO strings) */
function isNextDay(dateA: string, dateB: string): boolean {
  const a = new Date(dateA + 'T00:00:00')
  a.setDate(a.getDate() + 1)
  return toISODateString(a) === dateB
}

/** Generate ISO date strings for the last 16 weeks (Mon-aligned grid) */
function getLast16WeeksDates(): string[] {
  const dates: string[] = []
  const today = new Date()

  // Find the most recent Monday (or today if Monday)
  const day = today.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const thisMon = new Date(today)
  thisMon.setDate(thisMon.getDate() + diffToMonday)
  thisMon.setHours(0, 0, 0, 0)

  // Go back 15 more weeks for 16 total
  const startMon = new Date(thisMon)
  startMon.setDate(startMon.getDate() - 15 * 7)

  // Fill all days from startMon to this Sunday
  const endSun = new Date(thisMon)
  endSun.setDate(endSun.getDate() + 6)

  const current = new Date(startMon)
  while (current <= endSun) {
    dates.push(toISODateString(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}
