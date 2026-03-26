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
  onDefer: (id: string) => void
  showEnergy?: boolean
}

export function TodoItem({ todo, onComplete, onDefer, showEnergy = true }: TodoItemProps) {
  const [expanded, setExpanded] = useState(false)
  const { updateTodo, pinToToday, moveToBacklog, removeTodo } = useTodos()

  const setField = (field: string, value: unknown) => {
    updateTodo(todo.id, { [field]: value })
  }

  return (
    <div className="transition-colors duration-200">
      {/* Main row */}
      <div className="group flex items-start gap-3.5 py-3.5">
        {/* Checkbox */}
        <button
          onClick={() => onComplete(todo.id)}
          className="mt-0.5 w-5 h-5 rounded-full border-2 border-outline-variant flex-shrink-0 hover:border-primary hover:bg-primary/10 transition-all duration-300 cursor-pointer"
          aria-label={`Complete "${todo.title}"`}
        />

        {/* Content — tap to expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <p className="text-on-surface text-[15px] leading-snug">{todo.title}</p>

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

        {/* Defer — visible on hover / always on mobile */}
        <button
          onClick={() => onDefer(todo.id)}
          className="opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-60 text-xs text-on-surface-variant hover:text-on-surface px-2 py-1 rounded-lg hover:bg-surface-container transition-all duration-200 cursor-pointer flex-shrink-0"
          aria-label={`Defer "${todo.title}"`}
        >
          Later
        </button>
      </div>

      {/* Inline edit panel */}
      {expanded && (
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
                className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors duration-200 cursor-pointer"
              >
                Pin to Today
              </button>
            )}
            {todo.status !== 'backlog' && todo.status !== 'inbox' && (
              <button
                onClick={() => { moveToBacklog(todo.id); setExpanded(false) }}
                className="text-xs px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant font-medium hover:text-on-surface transition-colors duration-200 cursor-pointer"
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
