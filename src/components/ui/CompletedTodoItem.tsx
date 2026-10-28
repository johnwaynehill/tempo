import { useNavigate } from 'react-router'
import type { Todo } from '@/types'

interface CompletedTodoItemProps {
  todo: Todo
  /** Small line under the title, e.g. the project or when it was finished. */
  meta?: string
  onUndo: (id: string) => void
}

/** A finished todo: filled check, struck-through title, and Undo. Opens the todo on click. */
export function CompletedTodoItem({ todo, meta, onUndo }: CompletedTodoItemProps) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(`/todos/${todo.id}`)}
      className="w-full flex items-start gap-3 py-3 px-3 rounded-xl hover:bg-surface-container transition-colors duration-200 group text-left cursor-pointer"
    >
      {/* Filled checkmark */}
      <div className="mt-0.5 w-[18px] h-[18px] rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-primary" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2.5 6L5 8.5L9.5 3.5" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-on-surface/60 line-through leading-snug">
          {todo.title}
        </p>
        {meta && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-on-surface-variant/50">{meta}</span>
          </div>
        )}
      </div>

      {/* Undo button */}
      <span
        onClick={(e) => { e.stopPropagation(); onUndo(todo.id) }}
        className="opacity-0 group-hover:opacity-100 max-md:opacity-60 px-3 py-2 rounded-lg text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all duration-200 cursor-pointer flex-shrink-0 min-h-[44px] flex items-center"
        title="Mark as not completed"
      >
        Undo
      </span>
    </button>
  )
}
