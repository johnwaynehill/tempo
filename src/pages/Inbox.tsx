import { useState } from 'react'
import { TodoItem } from '@/components/ui/TodoItem'
import { useTodos } from '@/hooks/useTodos'

export function InboxPage() {
  const { inbox, completeTodo, moveToBacklog, loading } = useTodos()
  const [processed, setProcessed] = useState(0)
  const [movingAll, setMovingAll] = useState(false)

  const handleComplete = (id: string) => {
    completeTodo(id)
    setProcessed((n) => n + 1)
  }

  const handleMoveToBacklog = (id: string) => {
    moveToBacklog(id)
    setProcessed((n) => n + 1)
  }

  const handleMoveAll = async () => {
    setMovingAll(true)
    await Promise.all(inbox.map((t) => moveToBacklog(t.id)))
    setProcessed((n) => n + inbox.length)
    setMovingAll(false)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Inbox
        </h1>
        <p className="text-on-surface-variant text-sm">
          {inbox.length} item{inbox.length !== 1 ? 's' : ''} to process
          {processed > 0 && ` · ${processed} triaged`}
        </p>
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : (
        <>
          {/* Batch action — only show when there are 2+ items */}
          {inbox.length >= 2 && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={handleMoveAll}
                disabled={movingAll}
                className="text-xs text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded-lg hover:bg-surface-container-low transition-colors duration-200 cursor-pointer disabled:opacity-50"
              >
                {movingAll ? 'Moving...' : 'Move all to Backlog'}
              </button>
            </div>
          )}

          <div className="space-y-0">
            {inbox.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onComplete={handleComplete}
                onDefer={(id) => handleMoveToBacklog(id)}
                showEnergy={false}
              />
            ))}
          </div>

          {inbox.length === 0 && (
            <div className="text-center py-20">
              <p className="text-on-surface-variant text-sm">
                {processed > 0
                  ? `Inbox zero. ${processed} item${processed !== 1 ? 's' : ''} triaged.`
                  : 'Inbox zero. Nice.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
