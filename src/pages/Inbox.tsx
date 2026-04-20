import { useState } from 'react'
import { TodoItem } from '@/components/ui/TodoItem'
import { TodoDetailDrawer } from '@/components/ui/TodoDetailDrawer'
import { MenuButton } from '@/components/ui/MenuButton'
import { useTodos } from '@/hooks/useTodos'
import { useNewTodo } from '@/hooks/useNewTodo'

export function InboxPage() {
  const { inbox, completeTodo, deferTodo, moveToBacklog, loading } = useTodos()
  const { newTodo, createTodo, closeNewTodo } = useNewTodo('inbox')
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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Inbox
          </h1>
          <p className="text-on-surface-variant text-sm">
            {inbox.length} item{inbox.length !== 1 ? 's' : ''} to process
            {processed > 0 && ` · ${processed} triaged`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={createTodo}
            className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="New todo"
            title="New todo (C)"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <MenuButton />
        </div>
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
                className="text-xs text-on-surface-variant hover:text-on-surface px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors duration-200 cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {movingAll ? 'Moving...' : 'Move all to Backlog'}
              </button>
            </div>
          )}

          <div className="space-y-3">
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

      {/* New todo detail drawer */}
      {newTodo && (
        <TodoDetailDrawer
          todo={newTodo}
          onClose={closeNewTodo}
          onComplete={completeTodo}
          onDefer={deferTodo}
        />
      )}
    </div>
  )
}
