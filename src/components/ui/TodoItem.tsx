import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { Todo } from '@/types'
import { ENERGY_LABELS } from '@/types'
import { describeRecurrence } from '@/lib/recurrence'
import { useNotes } from '@/hooks/useNotes'
import { TodoDetailDrawer } from '@/components/ui/TodoDetailDrawer'
import { CompletionSparkle } from '@/components/ui/CompletionSparkle'
import { formatElapsed, formatMinutes, defaultEstimate } from '@/hooks/useTimer'

const SIZE_LABELS = { small: 'Small', medium: 'Medium', large: 'Large' } as const

interface TodoItemProps {
  todo: Todo
  onComplete: (id: string) => void
  onDefer: (id: string, until?: Date) => void
  showEnergy?: boolean
  /** Timer state for this item (optional — only passed from Today view) */
  timerActive?: boolean
  timerElapsed?: number
  onStartTimer?: (id: string) => void
}

export function TodoItem({ todo, onComplete, onDefer, showEnergy = true, timerActive, timerElapsed, onStartTimer }: TodoItemProps) {
  const [completing, setCompleting] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sparklePos, setSparklePos] = useState<{ x: number; y: number } | null>(null)
  const { notes } = useNotes()
  const navigate = useNavigate()

  const linkedNote = todo.note_id ? notes.find((n) => n.id === todo.note_id) : undefined

  const handleComplete = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setSparklePos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    setCompleting(true)
    setTimeout(() => {
      onComplete(todo.id)
    }, 700)
  }

  return (
    <>
      <div
        className={`transition-all duration-500 ease-out ${
          completing ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
        }`}
      >
        <div className="group flex items-start gap-3.5 py-3.5">
          {/* Checkbox */}
          <button
            onClick={handleComplete}
            disabled={completing}
            className={`mt-0.5 w-11 h-11 rounded-full flex-shrink-0 transition-all duration-300 cursor-pointer flex items-center justify-center ${
              completing
                ? ''
                : ''
            }`}
            aria-label={`Complete "${todo.title}"`}
          >
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
              completing
                ? 'border-primary bg-primary scale-110'
                : 'border-outline-variant group-hover:border-primary group-hover:bg-primary/10'
            }`}>
              {completing && (
                <svg className="w-3 h-3 text-on-primary" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2.5 6L5 8.5L9.5 3.5" />
                </svg>
              )}
            </span>
          </button>

          {/* Content — tap to open drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 min-w-0 text-left cursor-pointer"
          >
            <p className={`text-[15px] leading-snug transition-all duration-300 ${
              completing ? 'text-on-surface-variant line-through' : 'text-on-surface'
            }`}>
              {todo.title}
            </p>

            {/* Metadata chips */}
            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              {todo.project && (
                <span className="text-xs text-on-surface-variant">{todo.project}</span>
              )}
              {showEnergy && todo.energy_level && (
                <span className="text-xs px-2 py-0.5 rounded-lg bg-surface-container-high text-on-surface-variant">
                  {ENERGY_LABELS[todo.energy_level]}
                </span>
              )}
              {todo.size && (
                <span className="text-xs px-2 py-0.5 rounded-lg bg-surface-container-high text-on-surface-variant">
                  {SIZE_LABELS[todo.size]}
                </span>
              )}
              {todo.impact && (
                <span className="text-xs text-on-surface-variant">Impact {todo.impact}/5</span>
              )}
              {todo.estimated_minutes && (
                <span className="text-xs px-2 py-0.5 rounded-lg bg-surface-container-high text-on-surface-variant">
                  {formatMinutes(todo.estimated_minutes)}
                </span>
              )}
              {todo.due_date && (
                <span className="text-xs text-on-surface-variant">
                  {todo.due_date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {todo.recurrence && (
                <span className="text-xs text-on-surface-variant flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M9.5 2.5L10.5 3.5L9.5 4.5" />
                    <path d="M1.5 3.5h9" />
                    <path d="M2.5 9.5L1.5 8.5L2.5 7.5" />
                    <path d="M10.5 8.5h-9" />
                  </svg>
                  {describeRecurrence(todo.recurrence)}
                </span>
              )}
              {todo.reminder_at && (
                <span className="text-xs text-primary/70">
                  🔔 {todo.reminder_at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {linkedNote && (
                <span
                  className="text-xs text-primary/70 cursor-pointer hover:text-primary transition-colors"
                  onClick={(e) => { e.stopPropagation(); navigate(`/notes/${linkedNote.id}`) }}
                >
                  ¶ {linkedNote.title}
                </span>
              )}
            </div>
          </button>

          {/* Timer badge or play button */}
          {timerActive && timerElapsed !== undefined ? (
            <span className={`text-xs font-mono tabular-nums px-2 py-1 rounded-lg shrink-0 ${
              timerElapsed > (todo.estimated_minutes ?? defaultEstimate(todo.size)) * 60
                ? 'text-primary bg-primary/8'
                : 'text-on-surface-variant bg-surface-container'
            }`}>
              {formatElapsed(timerElapsed)}
            </span>
          ) : onStartTimer && !timerActive ? (
            <button
              onClick={(e) => { e.stopPropagation(); onStartTimer(todo.id) }}
              className="opacity-0 group-hover:opacity-100 max-md:opacity-60 w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/50 hover:text-primary hover:bg-primary/5 transition-all duration-200 cursor-pointer shrink-0"
              title={`Start timer (${formatMinutes(todo.estimated_minutes ?? defaultEstimate(todo.size))})`}
            >
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2l10 6-10 6z" />
              </svg>
            </button>
          ) : null}

          {/* Edit button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-60 text-xs text-on-surface-variant hover:text-on-surface px-3 py-2 rounded-lg hover:bg-surface-container transition-all duration-200 cursor-pointer flex-shrink-0 min-h-[44px]"
            aria-label={`Edit "${todo.title}"`}
          >
            Edit
          </button>
        </div>
      </div>

      {/* Completion sparkle */}
      {sparklePos && (
        <CompletionSparkle
          x={sparklePos.x}
          y={sparklePos.y}
          onComplete={() => setSparklePos(null)}
        />
      )}

      {/* Detail drawer */}
      {drawerOpen && !completing && (
        <TodoDetailDrawer
          todo={todo}
          onClose={() => setDrawerOpen(false)}
          onComplete={onComplete}
          onDefer={onDefer}
        />
      )}
    </>
  )
}
