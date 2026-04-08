import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { Todo } from '@/types'
import { ENERGY_LABELS, ENERGY_CHIP_STYLE, SIZE_CHIP_STYLE, projectChipStyle, impactChipStyle } from '@/types'
import { describeRecurrence } from '@/lib/recurrence'
import { useNotes } from '@/hooks/useNotes'
import { TodoDetailDrawer } from '@/components/ui/TodoDetailDrawer'
import { CompletionSparkle } from '@/components/ui/CompletionSparkle'
import { formatMinutes } from '@/hooks/useTimer'

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
  const [sparklePos, setSparklePos] = useState<{ x: number; y: number } | null>(null)
  const { notes } = useNotes()
  const navigate = useNavigate()

  const linkedNote = todo.note_id ? notes.find((n) => n.id === todo.note_id) : undefined

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation()
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
        {/* Card container */}
        <div
          onClick={() => setDrawerOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrawerOpen(true) } }}
          className="group w-full text-left rounded-2xl bg-surface-container-lowest px-4 py-3.5 cursor-pointer transition-colors hover:bg-surface-container-low"
        >
          <div className="flex items-start gap-2.5">
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-[15px] leading-snug transition-all duration-300 ${
                completing ? 'text-on-surface-variant line-through' : 'text-on-surface'
              }`}>
                {todo.title}
              </p>

              {/* Metadata chips */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {todo.project && (
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-md"
                    style={projectChipStyle(todo.project)}
                  >
                    {todo.project}
                  </span>
                )}
                {showEnergy && todo.energy_level && (
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-md"
                    style={ENERGY_CHIP_STYLE[todo.energy_level]}
                  >
                    {ENERGY_LABELS[todo.energy_level]}
                  </span>
                )}
                {todo.size && (
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-md"
                    style={SIZE_CHIP_STYLE[todo.size]}
                  >
                    {SIZE_LABELS[todo.size]}
                  </span>
                )}
                {todo.impact && (
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-md"
                    style={impactChipStyle(todo.impact)}
                  >
                    Impact {todo.impact}/5
                  </span>
                )}
                {todo.estimated_minutes && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant">
                    {formatMinutes(todo.estimated_minutes)}
                  </span>
                )}
                {todo.due_date && (
                  <span className="text-[11px] text-on-surface-variant">
                    {todo.due_date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {todo.recurrence && (
                  <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
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
                  <span className="text-[11px] text-primary/70">
                    {todo.reminder_at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {linkedNote && (
                  <span
                    className="text-[11px] text-primary/70 cursor-pointer hover:text-primary transition-colors"
                    onClick={(e) => { e.stopPropagation(); navigate(`/notes/${linkedNote.id}`) }}
                  >
                    {linkedNote.title}
                  </span>
                )}
              </div>
            </div>

            {/* Complete button — right side */}
            <button
              onClick={handleComplete}
              disabled={completing}
              className="mt-1 w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 transition-all duration-300 cursor-pointer flex items-center justify-center"
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
