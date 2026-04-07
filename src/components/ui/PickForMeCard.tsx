import type { Todo } from '@/types'
import { formatMinutes, defaultEstimate } from '@/hooks/useTimer'

interface PickForMeCardProps {
  todo: Todo
  reason: string
  onStart: (id: string) => void
  onDismiss: () => void
}

export function PickForMeCard({ todo, reason, onStart, onDismiss }: PickForMeCardProps) {
  const estimate = todo.estimated_minutes ?? defaultEstimate(todo.size)

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[380px] z-50 animate-gentle-appear">
      <div className="bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/15 p-4">
        {/* AI attribution */}
        <div className="flex items-center gap-1.5 mb-3">
          <svg className="w-3.5 h-3.5 text-primary/60" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7 2C7 5.5 9 7.5 13 8C9 8.5 7 10.5 7 14C7 10.5 5 8.5 1 8C5 7.5 7 5.5 7 2Z" />
            <path d="M13 0C13 1.2 13.8 2 15 2C13.8 2 13 2.8 13 4C13 2.8 12.2 2 11 2C12.2 2 13 1.2 13 0Z" opacity="0.55" />
          </svg>
          <span className="text-xs text-on-surface-variant/60 font-medium">Tempo picked for you</span>
        </div>

        {/* Task info */}
        <p className="text-on-surface font-medium text-sm mb-1">{todo.title}</p>
        <p className="text-on-surface-variant text-xs mb-3">{reason}</p>

        {/* Meta chips */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-on-surface-variant/50">
            {formatMinutes(estimate)}
          </span>
          {todo.project && (
            <span className="text-xs text-on-surface-variant/50">
              {todo.project}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStart(todo.id)}
            className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer"
          >
            Start this one
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant text-sm font-medium hover:text-on-surface transition-colors cursor-pointer"
          >
            Nah
          </button>
        </div>
      </div>
    </div>
  )
}
