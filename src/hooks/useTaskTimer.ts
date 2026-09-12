import { useCallback } from 'react'
import { useTimer } from '@/hooks/useTimer'
import type { UseTimerResult } from '@/hooks/useTimer'
import { useTodos } from '@/hooks/useTodos'
import { minutesToRecord } from '@/lib/time'

export interface StopResult {
  taskId: string | null
  /** Minutes this run adds; 0 when the run was too short to count. */
  minutes: number
  /** The task's actual_minutes after adding this run. */
  actualMinutes: number
}

export interface TaskTimer extends Omit<UseTimerResult, 'stop' | 'reset'> {
  /**
   * Stops the timer. By default the run is added to the task's actual_minutes;
   * pass persist: false when the caller writes the task itself (completion).
   */
  stop: (options?: { persist?: boolean }) => StopResult
}

/**
 * The page-facing timer: useTimer plus the bookkeeping that turns a run into
 * `started_at` and `actual_minutes` on the todo.
 */
export function useTaskTimer(): TaskTimer {
  const timer = useTimer()
  const { activeTaskId, start: startTimer, stop: stopTimer } = timer
  const { todos, updateTodo } = useTodos()

  const start = useCallback((id: string) => {
    const todo = todos.find((t) => t.id === id)
    if (todo && !todo.started_at) updateTodo(id, { started_at: new Date() })
    startTimer(id)
  }, [todos, updateTodo, startTimer])

  const stop = useCallback(({ persist = true }: { persist?: boolean } = {}): StopResult => {
    const taskId = activeTaskId
    const minutes = minutesToRecord(stopTimer())
    const prior = todos.find((t) => t.id === taskId)?.actual_minutes ?? 0
    const actualMinutes = prior + minutes
    if (persist && taskId && minutes > 0) updateTodo(taskId, { actual_minutes: actualMinutes })
    return { taskId, minutes, actualMinutes }
  }, [todos, updateTodo, activeTaskId, stopTimer])

  return {
    activeTaskId: timer.activeTaskId,
    elapsedSeconds: timer.elapsedSeconds,
    isRunning: timer.isRunning,
    isPaused: timer.isPaused,
    pause: timer.pause,
    resume: timer.resume,
    start,
    stop,
  }
}
