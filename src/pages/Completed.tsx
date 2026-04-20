import { useMemo, useState } from 'react'
import { useTodos } from '@/hooks/useTodos'
import { TodoDetailDrawer } from '@/components/ui/TodoDetailDrawer'
import { toISODateString } from '@/lib/dateUtils'
import { MenuButton } from '@/components/ui/MenuButton'
import type { Todo } from '@/types'

type TimePeriod = 'today' | 'week' | 'month' | 'all'

const PERIOD_LABELS: Record<TimePeriod, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
}

function getStartDate(period: TimePeriod): Date | null {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  switch (period) {
    case 'today':
      return d
    case 'week': {
      const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday start
      return d
    }
    case 'month':
      d.setDate(1)
      return d
    case 'all':
      return null
  }
}

function formatCompletedDate(date: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (toISODateString(date) === toISODateString(today)) return 'Today'
  if (toISODateString(date) === toISODateString(yesterday)) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function CompletedPage() {
  const { done, completeTodo, deferTodo, uncompleteTodo } = useTodos()
  const [period, setPeriod] = useState<TimePeriod>('today')
  const [drawerTodo, setDrawerTodo] = useState<Todo | null>(null)

  const filtered = useMemo(() => {
    const startDate = getStartDate(period)
    const items = startDate
      ? done.filter((t) => t.completed_at && t.completed_at >= startDate)
      : done

    // Sort by completed_at descending (most recent first)
    return [...items].sort((a, b) => {
      const aTime = a.completed_at?.getTime() ?? 0
      const bTime = b.completed_at?.getTime() ?? 0
      return bTime - aTime
    })
  }, [done, period])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Todo[]>()
    for (const todo of filtered) {
      if (!todo.completed_at) continue
      const key = toISODateString(todo.completed_at)
      const list = map.get(key) ?? []
      list.push(todo)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Completed
          </h1>
          <p className="text-on-surface-variant text-sm">
            {filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>
        <MenuButton />
      </div>

      {/* Period filter */}
      <div className="flex gap-1.5 mb-8">
        {(['today', 'week', 'month', 'all'] as TimePeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer min-h-[44px] ${
              period === p
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Grouped list */}
      {grouped.length > 0 ? (
        grouped.map(([dateKey, todos]) => (
          <div key={dateKey} className="mb-6">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="font-display text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                {formatCompletedDate(todos[0].completed_at!)}
              </span>
              <span className="text-xs text-on-surface-variant/50">
                {todos.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {todos.map((todo) => (
                <button
                  key={todo.id}
                  onClick={() => setDrawerTodo(todo)}
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
                    <div className="flex items-center gap-2 mt-0.5">
                      {todo.project && (
                        <span className="text-xs text-on-surface-variant/50">{todo.project}</span>
                      )}
                    </div>
                  </div>

                  {/* Undo button */}
                  <span
                    onClick={(e) => { e.stopPropagation(); uncompleteTodo(todo.id) }}
                    className="opacity-0 group-hover:opacity-100 max-md:opacity-60 px-3 py-2 rounded-lg text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all duration-200 cursor-pointer flex-shrink-0 min-h-[44px] flex items-center"
                    title="Mark as not completed"
                  >
                    Undo
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-20">
          <p className="text-on-surface-variant text-sm">
            {period === 'today' ? 'Nothing completed yet today.' : 'No completed tasks in this period.'}
          </p>
        </div>
      )}

      {drawerTodo && (
        <TodoDetailDrawer
          todo={drawerTodo}
          onClose={() => setDrawerTodo(null)}
          onComplete={completeTodo}
          onDefer={deferTodo}
        />
      )}
    </div>
  )
}
