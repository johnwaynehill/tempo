import { TodoItem } from '@/components/ui/TodoItem'
import type { Todo } from '@/types'

// Placeholder — will be replaced with Firestore query
const MOCK_INBOX: Todo[] = [
  {
    id: '10',
    title: 'Look into Railway deployment pricing',
    status: 'inbox',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '11',
    title: 'Research Milkdown plugin ecosystem',
    status: 'inbox',
    created_at: new Date(Date.now() - 86400000),
    updated_at: new Date(),
  },
]

export function InboxPage() {
  const handleComplete = (id: string) => {
    console.log('Complete:', id)
  }

  const handleDefer = (id: string) => {
    console.log('Move to backlog:', id)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Inbox
        </h1>
        <p className="text-on-surface-variant text-sm">
          {MOCK_INBOX.length} item{MOCK_INBOX.length !== 1 ? 's' : ''} to process
        </p>
      </div>

      <div className="space-y-0">
        {MOCK_INBOX.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onComplete={handleComplete}
            onDefer={handleDefer}
            showEnergy={false}
          />
        ))}
      </div>

      {MOCK_INBOX.length === 0 && (
        <div className="text-center py-20">
          <p className="text-on-surface-variant text-sm">
            Inbox zero. Nice.
          </p>
        </div>
      )}
    </div>
  )
}
