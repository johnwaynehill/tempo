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
            <div className="text-center py-20 animate-gentle-appear">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
                </svg>
              </div>
              <p className="text-on-surface font-display font-semibold text-base mb-1">
                Inbox zero
              </p>
              <p className="text-on-surface-variant text-sm">
                {processed > 0
                  ? `${processed} item${processed !== 1 ? 's' : ''} triaged. Nice work.`
                  : 'Nothing waiting. Enjoy the calm.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
