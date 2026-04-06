import type { Todo } from '@/types'
import { formatElapsed, formatMinutes, defaultEstimate } from '@/hooks/useTimer'
import type { UseTimerResult } from '@/hooks/useTimer'

interface TimerBarProps {
  todos: Todo[]
  timer: UseTimerResult
  onStartTimer: (taskId: string) => void
}

function getEstimate(todo: Todo): number {
  return todo.estimated_minutes ?? defaultEstimate(todo.size)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function TimerBar({ todos, timer, onStartTimer }: TimerBarProps) {
  if (todos.length === 0) return null

  const totalMinutes = todos.reduce((sum, t) => sum + getEstimate(t), 0)

  // If a timer is running, subtract elapsed time from the active task's estimate
  let remainingMinutes = totalMinutes
  if (timer.activeTaskId && timer.isRunning) {
    const elapsedMinutes = Math.floor(timer.elapsedSeconds / 60)
    remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes)
  }

  const endTime = new Date(Date.now() + remainingMinutes * 60 * 1000)
  const activeTodo = timer.activeTaskId ? todos.find((t) => t.id === timer.activeTaskId) : null
  const activeEstimate = activeTodo ? getEstimate(activeTodo) : 0
  const isOvertime = activeTodo && timer.elapsedSeconds > activeEstimate * 60

  return (
    <div className="mb-6 rounded-xl bg-surface-container-low px-4 py-3">
      {/* End time + total */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-on-surface-variant">
          Done by ~{formatTime(endTime)}
        </span>
        <span className="text-on-surface-variant">
          {formatMinutes(remainingMinutes)} left
        </span>
      </div>

      {/* Active timer display */}
      {timer.isRunning && activeTodo && (
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${timer.isPaused ? 'bg-on-surface-variant/40' : isOvertime ? 'bg-primary/60 animate-pulse' : 'bg-primary animate-pulse'}`} />
            <span className="text-on-surface text-sm font-medium truncate">
              {activeTodo.title}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className={`text-sm font-mono tabular-nums ${isOvertime ? 'text-primary' : 'text-on-surface-variant'}`}>
              {formatElapsed(timer.elapsedSeconds)}
              <span className="text-on-surface-variant/50"> / {formatMinutes(activeEstimate)}</span>
            </span>
            <button
              onClick={() => timer.isPaused ? timer.resume() : timer.pause()}
              className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title={timer.isPaused ? 'Resume' : 'Pause'}
            >
              {timer.isPaused ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2l10 6-10 6z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="2" width="4" height="12" rx="1" />
                  <rect x="9" y="2" width="4" height="12" rx="1" />
                </svg>
              )}
            </button>
            <button
              onClick={() => timer.stop()}
              className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Stop timer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="3" width="10" height="10" rx="1.5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Start prompt when no timer running */}
      {!timer.isRunning && todos.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => onStartTimer(todos[0].id)}
            className="flex items-center gap-1.5 text-primary text-xs font-medium hover:text-primary-dim transition-colors cursor-pointer"
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2l10 6-10 6z" />
            </svg>
            Start timer
          </button>
        </div>
      )}
    </div>
  )
}
