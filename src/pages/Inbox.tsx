import { TodoItem } from '@/components/ui/TodoItem'
import { useTodos } from '@/hooks/useTodos'

export function InboxPage() {
  const { inbox, completeTodo, moveToBacklog, loading } = useTodos()

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Inbox
        </h1>
        <p className="text-on-surface-variant text-sm">
          {inbox.length} item{inbox.length !== 1 ? 's' : ''} to process
        </p>
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : (
        <>
          <div className="space-y-0">
            {inbox.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onComplete={completeTodo}
                onDefer={(id) => moveToBacklog(id)}
                showEnergy={false}
              />
            ))}
          </div>

          {inbox.length === 0 && (
            <div className="text-center py-20">
              <p className="text-on-surface-variant text-sm">
                Inbox zero. Nice.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
