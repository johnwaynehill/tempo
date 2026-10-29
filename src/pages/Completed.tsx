import { useMemo, useState } from 'react'
import { useTodos } from '@/hooks/useTodos'
import { formatRelativeDay, toISODateString } from '@/lib/dateUtils'
import { MenuButton } from '@/components/ui/MenuButton'
import { CompletedTodoItem } from '@/components/ui/CompletedTodoItem'
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

export function CompletedPage() {
  const { done, uncompleteTodo } = useTodos()
  const [period, setPeriod] = useState<TimePeriod>('today')

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
                {formatRelativeDay(todos[0].completed_at!)}
              </span>
              <span className="text-xs text-on-surface-variant/50">
                {todos.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {todos.map((todo) => (
                <CompletedTodoItem
                  key={todo.id}
                  todo={todo}
                  meta={todo.project}
                  onUndo={uncompleteTodo}
                />
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

    </div>
  )
}
