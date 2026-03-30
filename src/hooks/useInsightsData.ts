import { useMemo } from 'react'
import type { Todo } from '@/types'
import {
  startOfDay,
  endOfDay,
  isSameDay,
  eachDayOfRange,
  getStartOfWeek,
  toISODateString,
  dayName,
} from '@/lib/dateUtils'

export interface ProjectBreakdown {
  project: string
  count: number
  onTime: number
  late: number
}

export interface TrendPoint {
  label: string
  value: number
}

export interface InsightsData {
  totalCompleted: number
  completedOnTime: number
  completedLate: number
  completedNoDueDate: number

  byProject: ProjectBreakdown[]
  dailyTrend: TrendPoint[]
  weeklyTrend: TrendPoint[]
  monthlyTrend: TrendPoint[]

  currentStreak: number
  bestStreak: number
  avgPerDay: number
  mostProductiveDay: string | null
  topProject: string | null
}

export function useInsightsData(
  done: Todo[],
  range: { start: Date; end: Date },
): InsightsData {
  return useMemo(() => {
    const rangeStart = startOfDay(range.start)
    const rangeEnd = endOfDay(range.end)

    // Filter completed todos within range (must have completed_at)
    const inRange = done.filter(
      (t) => t.completed_at && t.completed_at >= rangeStart && t.completed_at <= rangeEnd,
    )

    const totalCompleted = inRange.length

    // On-time vs late
    let completedOnTime = 0
    let completedLate = 0
    let completedNoDueDate = 0

    for (const t of inRange) {
      if (!t.due_date) {
        completedNoDueDate++
      } else if (t.completed_at! <= endOfDay(t.due_date)) {
        completedOnTime++
      } else {
        completedLate++
      }
    }

    // By project
    const projectMap = new Map<string, { count: number; onTime: number; late: number }>()
    for (const t of inRange) {
      const key = t.project || 'Ungrouped'
      const entry = projectMap.get(key) ?? { count: 0, onTime: 0, late: 0 }
      entry.count++
      if (t.due_date) {
        if (t.completed_at! <= endOfDay(t.due_date)) {
          entry.onTime++
        } else {
          entry.late++
        }
      }
      projectMap.set(key, entry)
    }
    const byProject = [...projectMap.entries()]
      .map(([project, data]) => ({ project, ...data }))
      .sort((a, b) => b.count - a.count)

    // Daily trend
    const days = eachDayOfRange(rangeStart, rangeEnd)
    const dailyTrend: TrendPoint[] = days.map((day) => {
      const count = inRange.filter((t) => isSameDay(t.completed_at!, day)).length
      return {
        label: `${day.getMonth() + 1}/${day.getDate()}`,
        value: count,
      }
    })

    // Weekly trend
    const weekMap = new Map<string, number>()
    for (const t of inRange) {
      const ws = getStartOfWeek(t.completed_at!)
      const key = toISODateString(ws)
      weekMap.set(key, (weekMap.get(key) ?? 0) + 1)
    }
    const weeklyTrend: TrendPoint[] = [...weekMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, count]) => {
        const d = new Date(weekStart + 'T00:00:00')
        return {
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          value: count,
        }
      })

    // Monthly trend
    const monthMap = new Map<string, number>()
    for (const t of inRange) {
      const d = t.completed_at!
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
    }
    const monthlyTrend: TrendPoint[] = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => {
        const [, m] = month.split('-')
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return {
          label: monthNames[parseInt(m) - 1],
          value: count,
        }
      })

    // Streak calculation (consecutive days with at least 1 completion)
    const today = startOfDay(new Date())
    const allDoneWithDate = done
      .filter((t) => t.completed_at)
      .sort((a, b) => b.completed_at!.getTime() - a.completed_at!.getTime())

    const completionDays = new Set<string>()
    for (const t of allDoneWithDate) {
      completionDays.add(toISODateString(t.completed_at!))
    }

    let currentStreak = 0
    let bestStreak = 0
    let streakDay = new Date(today)

    // Allow current streak to start from today or yesterday
    if (!completionDays.has(toISODateString(streakDay))) {
      streakDay.setDate(streakDay.getDate() - 1)
    }

    let tempStreak = 0
    while (completionDays.has(toISODateString(streakDay))) {
      tempStreak++
      streakDay.setDate(streakDay.getDate() - 1)
    }
    currentStreak = tempStreak

    // Best streak: iterate all sorted unique days
    const sortedDays = [...completionDays].sort()
    tempStreak = 1
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1] + 'T00:00:00')
      const curr = new Date(sortedDays[i] + 'T00:00:00')
      const diffMs = curr.getTime() - prev.getTime()
      if (diffMs === 86400000) {
        tempStreak++
      } else {
        bestStreak = Math.max(bestStreak, tempStreak)
        tempStreak = 1
      }
    }
    bestStreak = Math.max(bestStreak, tempStreak, currentStreak)
    if (sortedDays.length === 0) bestStreak = 0

    // Avg per day
    const totalDays = Math.max(1, days.length)
    const avgPerDay = totalCompleted / totalDays

    // Most productive day of week
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0] // Sun-Sat
    for (const t of inRange) {
      dayOfWeekCounts[t.completed_at!.getDay()]++
    }
    const maxDayCount = Math.max(...dayOfWeekCounts)
    let mostProductiveDay: string | null = null
    if (maxDayCount > 0) {
      const maxDayIndex = dayOfWeekCounts.indexOf(maxDayCount)
      const refDate = new Date(2026, 0, 4 + maxDayIndex) // Jan 4, 2026 is a Sunday
      mostProductiveDay = dayName(refDate)
    }

    // Top project
    const topProject = byProject.length > 0 ? byProject[0].project : null

    return {
      totalCompleted,
      completedOnTime,
      completedLate,
      completedNoDueDate,
      byProject,
      dailyTrend,
      weeklyTrend,
      monthlyTrend,
      currentStreak,
      bestStreak,
      avgPerDay,
      mostProductiveDay,
      topProject,
    }
  }, [done, range.start.getTime(), range.end.getTime()])
}
