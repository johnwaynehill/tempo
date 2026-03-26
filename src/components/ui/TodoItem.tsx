import { useState } from 'react'
import type { Todo, TodoSize } from '@/types'
import { ENERGY_LABELS, ENERGY_LEVELS } from '@/types'
import { useTodos } from '@/hooks/useTodos'

const SIZE_LABELS: Record<TodoSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

interface TodoItemProps {
  todo: Todo
  onComplete: (id: string) => void
  onDefer: (id: string, until?: Date) => void
  showEnergy?: boolean
}

export function TodoItem({ todo, onComplete, onDefer, showEnergy = true }: TodoItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showDeferMenu, setShowDeferMenu] = useState(false)
  const { updateTodo, pinToToday, moveToBacklog, removeTodo } = useTodos()

  const setField = (field: string, value: unknown) => {
    updateTodo(todo.id, { [field]: value })
  }

  const handleComplete = () => {
    setCompleting(true)
    // Let the checkbox fill + strikethrough show (200ms),
    // then fade out (500ms), then fire the actual completion
    setTimeout(() => {
      onComplete(todo.id)
    }, 700)
  }

  const handleDeferOption = (until: Date) => {
    setShowDeferMenu(false)
    onDefer(todo.id, until)
  }

  // Defer date helpers
  const tomorrow = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d
  }

  const nextWeek = () => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setHours(9, 0, 0, 0)
    return d
  }

  const nextMonth = () => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    d.setHours(9, 0, 0, 0)
    return d
  }

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        completing
          ? 'opacity-0 translate-x-4'
          : 'opacity-100 translate-x-0'
      }`}
    >
      {/* Main row */}
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

        {/* Content — tap to expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <p className={`text-[15px] leading-snug transition-all duration-300 ${
            completing
              ? 'text-on-surface-variant line-through'
              : 'text-on-surface'
          }`}>
            {todo.title}
          </p>

          {/* Metadata row */}
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            {todo.project && (
              <span className="text-xs text-on-surface-variant">
                {todo.project}
              </span>
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
              <span className="text-xs text-on-surface-variant">
                Impact {todo.impact}/5
              </span>
            )}
            {todo.due_date && (
              <span className="text-xs text-on-surface-variant">
                {todo.due_date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </button>

        {/* Defer button with popover */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowDeferMenu(!showDeferMenu)}
            className="opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-60 text-xs text-on-surface-variant hover:text-on-surface px-2 py-1 rounded-lg hover:bg-surface-container transition-all duration-200 cursor-pointer"
            aria-label={`Defer "${todo.title}"`}
          >
            Later
          </button>

          {showDeferMenu && (
            <>
              {/* Invisible click-away backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDeferMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[140px]">
                <button
                  onClick={() => handleDeferOption(tomorrow())}
                  className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  onClick={() => handleDeferOption(nextWeek())}
                  className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  Next week
                </button>
                <button
                  onClick={() => handleDeferOption(nextMonth())}
                  className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  Next month
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inline edit panel */}
      {expanded && !completing && (
        <div className="ml-8.5 pb-4 space-y-4">
          {/* Title edit */}
          <input
            type="text"
            defaultValue={todo.title}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== todo.title) setField('title', v)
            }}
            className="w-full bg-surface-container-lowest rounded-lg px-3 py-2 text-on-surface text-sm outline-none"
          />

          {/* Fields grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Energy */}
            <div>
              <label className="text-xs text-on-surface-variant mb-1.5 block">Energy</label>
              <div className="flex gap-1.5 flex-wrap">
                {ENERGY_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setField('energy_level', todo.energy_level === level ? null : level)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                      todo.energy_level === level
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {ENERGY_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <label className="text-xs text-on-surface-variant mb-1.5 block">Size</label>
              <div className="flex gap-1.5">
                {(['small', 'medium', 'large'] as TodoSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setField('size', todo.size === size ? null : size)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                      todo.size === size
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {SIZE_LABELS[size]}
                  </button>
                ))}
              </div>
            </div>

            {/* Impact */}
            <div>
              <label className="text-xs text-on-surface-variant mb-1.5 block">Impact</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setField('impact', todo.impact === n ? null : n)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                      todo.impact === n
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Project */}
            <div>
              <label className="text-xs text-on-surface-variant mb-1.5 block">Project</label>
              <input
                type="text"
                defaultValue={todo.project ?? ''}
                placeholder="e.g. Tempo"
                onBlur={(e) => setField('project', e.target.value.trim() || null)}
                className="w-full bg-surface-container-high rounded-lg px-3 py-1.5 text-on-surface text-xs outline-none placeholder:text-on-surface-variant/40"
              />
            </div>

            {/* Due date */}
            <div>
              <label className="text-xs text-on-surface-variant mb-1.5 block">Due date</label>
              <input
                type="date"
                defaultValue={todo.due_date?.toISOString().split('T')[0] ?? ''}
                onChange={(e) => setField('due_date', e.target.value ? new Date(e.target.value + 'T00:00:00') : null)}
                className="w-full bg-surface-container-high rounded-lg px-3 py-1.5 text-on-surface text-xs outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {todo.status !== 'today_pinned' && (
              <button
                onClick={() => { pinToToday(todo.id); setExpanded(false) }}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-200 cursor-pointer ${
                  todo.status === 'inbox'
                    ? 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                Pin to Today
              </button>
            )}
            {todo.status !== 'backlog' && (
              <button
                onClick={() => { moveToBacklog(todo.id); setExpanded(false) }}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-200 cursor-pointer ${
                  todo.status === 'inbox'
                    ? 'bg-gradient-to-br from-primary to-primary-dim text-on-primary hover:shadow-md'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Move to Backlog
              </button>
            )}
            <button
              onClick={() => removeTodo(todo.id)}
              className="text-xs px-3 py-1.5 rounded-lg text-error/70 hover:text-error hover:bg-error/5 font-medium transition-colors duration-200 cursor-pointer ml-auto"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
