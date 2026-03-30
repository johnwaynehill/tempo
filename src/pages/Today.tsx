import { useMemo } from 'react'
import { EnergySelector } from '@/components/ui/EnergySelector'
import { TodoItem } from '@/components/ui/TodoItem'
import { MobileMenu } from '@/components/ui/MobileMenu'
import { useTodos } from '@/hooks/useTodos'
import { usePreferences } from '@/hooks/usePreferences'
import { useTodaySet } from '@/hooks/useTodaySet'

export function TodayPage() {
  const { todos, pinned, done, completeTodo, deferTodo, dismissFromToday, loading: todosLoading } = useTodos()
  const { preferences, updatePreferences } = usePreferences()
  const { todayTodos, loading: setLoading, dismissFromSet } = useTodaySet(todos, pinned, preferences.current_energy)

  const loading = todosLoading || setLoading

  // Count items completed today
  const todayCompletedCount = useMemo(() => {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    return done.filter((t) => t.completed_at && t.completed_at >= startOfDay).length
  }, [done])

  // Vary the empty state message based on completions
  const emptyMessage = todayCompletedCount === 0
    ? 'Nothing on your plate. Enjoy the quiet.'
    : todayCompletedCount === 1
      ? 'All done. You knocked out 1 task today.'
      : `All done. You knocked out ${todayCompletedCount} tasks today.`

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Today
          </h1>
          <p className="text-on-surface-variant text-sm">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <MobileMenu />
      </div>

      {/* Energy selector — always visible per PRD §7.5 */}
      <div className="mb-8">
        <EnergySelector
          value={preferences.current_energy}
          onChange={(level) => updatePreferences({ current_energy: preferences.current_energy === level ? undefined : level })}
        />
      </div>

      {/* Today's tasks */}
      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : (
        <>
          <div className="space-y-0">
            {todayTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onComplete={completeTodo}
                onDefer={(id, until) => {
                  if (todo.status === 'today_pinned') {
                    deferTodo(id, until)
                  } else {
                    // Remove from the daily set and dismiss
                    dismissFromSet(id)
                    dismissFromToday(id)
                  }
                }}
              />
            ))}
          </div>

          {todayTodos.length === 0 && (
            <div className="text-center py-20 animate-gentle-appear">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L19 7" />
                </svg>
              </div>
              <p className="text-on-surface font-display font-semibold text-base mb-1">
                {todayCompletedCount === 0 ? 'Clear skies' : 'All done'}
              </p>
              <p className="text-on-surface-variant text-sm">
                {emptyMessage}
              </p>
            </div>
          )}

          {/* Subtle completion counter when items remain */}
          {todayTodos.length > 0 && todayCompletedCount > 0 && (
            <div className="mt-6 text-center">
              <p className="text-on-surface-variant/60 text-xs">
                {todayCompletedCount} done today
              </p>
            </div>
          )}
        </>
      )}

    </div>
  )
}
