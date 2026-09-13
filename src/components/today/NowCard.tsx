import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { Todo } from '@/types'
import { projectChipStyle } from '@/types'
import type { TaskTimer } from '@/hooks/useTaskTimer'
import { CompletionSparkle } from '@/components/ui/CompletionSparkle'
import { getEstimate, remainingMinutes, projectedEndTime, formatClock, formatElapsed, formatMinutes } from '@/lib/time'

const ICON_BUTTON = 'w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer'

function PlayIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4 2l10 6-10 6z" />
    </svg>
  )
}

interface DaySummaryProps {
  todos: Todo[]
  timer: TaskTimer
  onStart: (id: string) => void
  /** A gentle sentence under the line, e.g. the overcommitment check. */
  note?: string | null
}

/**
 * One line above the task list: how much is planned and when it would be done.
 * Offers a Start button until a timer is running; after that the Now card has the controls.
 */
export function DaySummary({ todos, timer, onStart, note }: DaySummaryProps) {
  if (todos.length === 0) return null

  const snapshot = timer.isRunning ? timer : null
  const left = remainingMinutes(todos, snapshot)
  const endTime = projectedEndTime(todos, snapshot)

  return (
    <div className="mb-3 px-1">
      <div className="flex items-center justify-between gap-3 text-sm text-on-surface-variant min-h-[36px]">
      <p className="tabular-nums truncate">
        {todos.length} task{todos.length !== 1 ? 's' : ''}
        <span className="mx-1.5 opacity-50">·</span>
        {formatMinutes(left)}
        <span className="mx-1.5 opacity-50">·</span>
        done by ~{formatClock(endTime)}
      </p>
      {!timer.isRunning && (
        <button
          onClick={() => onStart(todos[0].id)}
          className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 -my-1.5 rounded-lg text-primary text-xs font-medium hover:bg-primary/10 transition-colors cursor-pointer min-h-[36px]"
        >
          <PlayIcon className="w-3 h-3" />
          Start
        </button>
      )}
      </div>
      {note && (
        <p className="text-xs text-on-surface-variant/80 mt-1 max-w-md">{note}</p>
      )}
    </div>
  )
}

interface NowCardProps {
  todo: Todo
  timer: TaskTimer
  onComplete: (id: string) => void
}

/** The running task, lifted out of the list into a card with its timer and controls. */
export function NowCard({ todo, timer, onComplete }: NowCardProps) {
  const navigate = useNavigate()
  const [completing, setCompleting] = useState(false)
  const [sparklePos, setSparklePos] = useState<{ x: number; y: number } | null>(null)

  const estimateSeconds = getEstimate(todo) * 60
  const isOvertime = timer.elapsedSeconds > estimateSeconds
  const progress = Math.min(100, (timer.elapsedSeconds / estimateSeconds) * 100)

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setSparklePos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    setCompleting(true)
    setTimeout(() => onComplete(todo.id), 700)
  }

  return (
    <>
      <div
        className={`mb-3 rounded-2xl bg-surface-container-lowest px-4 pt-3.5 pb-3 transition-all duration-500 ease-out ${
          completing ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={() => navigate(`/todos/${todo.id}`)}
            className="flex-1 min-w-0 text-left cursor-pointer"
          >
            <p className={`text-[15px] leading-snug transition-all duration-300 ${
              completing ? 'text-on-surface-variant line-through' : 'text-on-surface'
            }`}>
              {todo.title}
            </p>
            {todo.project && (
              <span
                className="inline-block mt-1.5 text-[11px] px-1.5 py-0.5 rounded-md"
                style={projectChipStyle(todo.project)}
              >
                {todo.project}
              </span>
            )}
          </button>
          <span className={`shrink-0 text-sm font-mono tabular-nums ${isOvertime ? 'text-primary' : 'text-on-surface-variant'}`}>
            {formatElapsed(timer.elapsedSeconds)}
            <span className="text-on-surface-variant/50"> / {formatMinutes(getEstimate(todo))}</span>
          </span>
        </div>

        {/* Progress — fills with sage, stays full past the estimate */}
        <div className="mt-3 h-1 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${isOvertime ? 'bg-primary/40' : 'bg-primary'}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-2 flex items-center gap-1">
          <button
            onClick={() => timer.isPaused ? timer.resume() : timer.pause()}
            className={ICON_BUTTON}
            aria-label={timer.isPaused ? 'Resume timer' : 'Pause timer'}
            title={timer.isPaused ? 'Resume' : 'Pause'}
          >
            {timer.isPaused ? (
              <PlayIcon />
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            )}
          </button>
          <button
            onClick={() => timer.stop()}
            className={ICON_BUTTON}
            aria-label="Stop timer"
            title="Stop timer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="10" height="10" rx="1.5" />
            </svg>
          </button>
          {timer.isPaused && (
            <span className="ml-1 text-xs text-on-surface-variant/60">Paused</span>
          )}

          <button
            onClick={handleComplete}
            disabled={completing}
            className="group ml-auto w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center cursor-pointer"
            aria-label={`Complete "${todo.title}"`}
          >
            <span className={`w-[18px] h-[18px] md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
              completing
                ? 'border-primary bg-primary scale-110'
                : 'border-outline-variant group-hover:border-primary group-hover:bg-primary/10'
            }`}>
              {completing && (
                <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-on-primary" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2.5 6L5 8.5L9.5 3.5" />
                </svg>
              )}
            </span>
          </button>
        </div>
      </div>

      {sparklePos && (
        <CompletionSparkle
          x={sparklePos.x}
          y={sparklePos.y}
          onComplete={() => setSparklePos(null)}
        />
      )}
    </>
  )
}
