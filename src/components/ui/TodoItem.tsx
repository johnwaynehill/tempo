import type { Todo } from '@/types'
import { ENERGY_LABELS } from '@/types'

interface TodoItemProps {
  todo: Todo
  onComplete: (id: string) => void
  onDefer: (id: string) => void
  showEnergy?: boolean
}

export function TodoItem({ todo, onComplete, onDefer, showEnergy = true }: TodoItemProps) {
  return (
    <div className="group flex items-start gap-3.5 py-3.5 transition-colors duration-200">
      {/* Checkbox */}
      <button
        onClick={() => onComplete(todo.id)}
        className="mt-0.5 w-5 h-5 rounded-full border-2 border-outline-variant flex-shrink-0 hover:border-primary hover:bg-primary/10 transition-all duration-300 cursor-pointer"
        aria-label={`Complete "${todo.title}"`}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
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
          {todo.due_date && (
            <span className="text-xs text-on-surface-variant">
              {todo.due_date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Defer — visible on hover / always on mobile */}
      <button
        onClick={() => onDefer(todo.id)}
        className="opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-60 text-xs text-on-surface-variant hover:text-on-surface px-2 py-1 rounded-lg hover:bg-surface-container transition-all duration-200 cursor-pointer flex-shrink-0"
        aria-label={`Defer "${todo.title}"`}
      >
        Later
      </button>
    </div>
  )
}
