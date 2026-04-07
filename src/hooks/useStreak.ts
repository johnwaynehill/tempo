import { useMemo } from 'react'
import type { Todo } from '@/types'

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

interface UseStreakResult {
  /** Number of consecutive days with at least 1 completion (including today if applicable) */
  currentStreak: number
  /** Whether the user has completed at least 1 task today */
  hasCompletedToday: boolean
}

export function useStreak(todos: Todo[]): UseStreakResult {
  return useMemo(() => {
    const done = todos.filter((t) => t.status === 'done' && t.completed_at)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const hasCompletedToday = done.some((t) => t.completed_at! >= today)

    // Walk backward from today (or yesterday if nothing done today yet)
    let streak = 0
    const startDate = new Date(today)

    if (hasCompletedToday) {
      streak = 1
      startDate.setDate(startDate.getDate() - 1)
    } else {
      // Check if yesterday had completions — if not, streak is 0
      startDate.setDate(startDate.getDate() - 1)
    }

    // Walk backward
    const cursor = new Date(startDate)
    for (let i = 0; i < 365; i++) {
      const dayHasCompletion = done.some((t) => sameDay(t.completed_at!, cursor))
      if (!dayHasCompletion) break
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }

    return { currentStreak: streak, hasCompletedToday }
  }, [todos])
}
