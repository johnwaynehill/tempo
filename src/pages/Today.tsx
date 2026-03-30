import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { EnergySelector } from '@/components/ui/EnergySelector'
import { TodoItem } from '@/components/ui/TodoItem'
import { useTodos } from '@/hooks/useTodos'
import { usePreferences } from '@/hooks/usePreferences'
import { useTodaySet } from '@/hooks/useTodaySet'
import { useAuth } from '@/context/AuthContext'

export function TodayPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
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

        {/* Menu button (mobile only — desktop has sidebar) */}
        <div className="relative md:hidden">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="Menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[200px]">
                {/* Nav links */}
                <button
                  onClick={() => { navigate('/insights'); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  Insights
                </button>
                <button
                  onClick={() => { navigate('/review'); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                  </svg>
                  Weekly Review
                </button>
                <button
                  onClick={() => { navigate('/settings'); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                  Settings
                </button>

                {/* Divider + user info */}
                {user && (
                  <>
                    <div className="border-t border-outline-variant/15 my-1.5" />
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      {user.photoURL && (
                        <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-on-surface text-xs font-medium truncate">{user.displayName}</p>
                        <p className="text-on-surface-variant text-[11px] truncate">{user.email}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
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
