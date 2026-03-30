import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { Todo } from '@/types'
import { ENERGY_LABELS } from '@/types'
import { describeRecurrence } from '@/lib/recurrence'
import { useNotes } from '@/hooks/useNotes'
import { TodoDetailDrawer } from '@/components/ui/TodoDetailDrawer'

const SIZE_LABELS = { small: 'Small', medium: 'Medium', large: 'Large' } as const

interface TodoItemProps {
  todo: Todo
  onComplete: (id: string) => void
  onDefer: (id: string, until?: Date) => void
  showEnergy?: boolean
}

export function TodoItem({ todo, onComplete, onDefer, showEnergy = true }: TodoItemProps) {
  const [completing, setCompleting] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { notes } = useNotes()
  const navigate = useNavigate()

  const linkedNote = todo.note_id ? notes.find((n) => n.id === todo.note_id) : undefined

  const handleComplete = () => {
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
            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all duration-300 cursor-pointer flex items-center justify-center ${
              completing
                ? 'border-primary bg-primary scale-110'
                : 'border-outline-variant hover:border-primary hover:bg-primary/10'
            }`}
            aria-label={`Complete "${todo.title}"`}
          >
            {completing && (
              <svg className="w-3 h-3 text-on-primary" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2.5 6L5 8.5L9.5 3.5" />
              </svg>
            )}
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

          {/* Subtle "Later" on hover */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-60 text-xs text-on-surface-variant hover:text-on-surface px-2 py-1 rounded-lg hover:bg-surface-container transition-all duration-200 cursor-pointer flex-shrink-0"
            aria-label={`Edit "${todo.title}"`}
          >
            Edit
          </button>
        </div>
      </div>

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
