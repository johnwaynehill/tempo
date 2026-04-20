import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { MenuButton } from '@/components/ui/MenuButton'
import { TodoItem } from '@/components/ui/TodoItem'
import { CompletionToast } from '@/components/ui/CompletionToast'
import { MoodBlob, moodFromValue, MOOD_LABELS } from '@/components/ui/MoodBlob'
import { useTodos } from '@/hooks/useTodos'
import { usePreferences } from '@/hooks/usePreferences'
import { useTodaySet } from '@/hooks/useTodaySet'
import { useCompletionToast } from '@/hooks/useCompletionToast'
import { useStreak } from '@/hooks/useStreak'
import { useMood } from '@/hooks/useMood'
import { StreakIndicator } from '@/components/ui/StreakIndicator'
import { AI_ENABLED } from '@/lib/anthropic'

export function TodayPage() {
  const navigate = useNavigate()
  const { todos, pinned, done, completeTodo, deferTodo, dismissFromToday, loading: todosLoading } = useTodos()
  const { preferences } = usePreferences()
  const { todayTodos, loading: setLoading, dismissFromSet } = useTodaySet(todos, pinned, preferences.current_energy)
  const { message: toastMessage, trigger: triggerToast, dismiss: dismissToast } = useCompletionToast()
  const { currentStreak, hasCompletedToday } = useStreak(todos)
  const { latestMood } = useMood()
  const [aiInput, setAiInput] = useState('')

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
    <div className="pb-16">
      {/* Page header */}
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight">
              Today
            </h1>
            <StreakIndicator currentStreak={currentStreak} hasCompletedToday={hasCompletedToday} />
          </div>
          <p className="text-on-surface-variant text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => navigate('/plan')}
            className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="Plan my day"
            title="Plan my day"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </button>
          {todayTodos.length > 0 && (
            <button
              onClick={() => navigate('/focus')}
              className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              aria-label="Focus mode"
              title="Focus mode (F)"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </button>
          )}
          <MenuButton />
        </div>
      </div>

      {/* Mood check-in — compact entry point to /mood page */}
      <button
        onClick={() => navigate('/mood')}
        className="mb-4 md:mb-6 w-full flex items-center gap-3 px-4 py-2.5 md:py-3 rounded-xl text-left cursor-pointer transition-all hover:bg-surface-container-low group min-h-[44px]"
      >
        {latestMood && latestMood.created_at >= new Date(new Date().setHours(0, 0, 0, 0)) ? (
          <>
            <MoodBlob mood={moodFromValue(latestMood.value)} size={28} />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-on-surface font-medium">
                {MOOD_LABELS[moodFromValue(latestMood.value)]}
              </span>
              {latestMood.note && (
                <p className="text-xs text-on-surface-variant truncate">{latestMood.note}</p>
              )}
            </div>
            <span className="text-xs text-on-surface-variant opacity-60 group-hover:opacity-100 transition-opacity">
              Check in →
            </span>
          </>
        ) : (
          <>
            <span className="text-lg">☺</span>
            <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
              How are you feeling?
            </span>
            <span className="ml-auto text-xs text-on-surface-variant opacity-0 group-hover:opacity-60 transition-opacity">
              Log mood →
            </span>
          </>
        )}
      </button>

      {/* Today's tasks */}
      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : (
        <>
          <div className="space-y-3">
            {todayTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onComplete={(id) => {
                  completeTodo(id)
                  triggerToast(todo.title)
                }}
                onDefer={(id, until) => {
                  if (todo.status === 'today_pinned') {
                    deferTodo(id, until)
                  } else {
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

      {/* AI Chat Bar — sticky above bottom nav */}
      {AI_ENABLED && (
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 md:left-52 z-30 px-4 pb-2 pt-2 bg-surface/80 backdrop-blur-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const text = aiInput.trim()
              if (!text) return
              navigate(`/chat?mode=today&q=${encodeURIComponent(text)}`)
            }}
            className="max-w-3xl mx-auto flex items-center gap-2 bg-surface-container-low rounded-2xl px-4 py-2.5 border border-outline-variant/15 focus-within:border-primary/30 transition-colors"
          >
            <svg className="w-4 h-4 text-primary/50 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 2C7 5.5 9 7.5 13 8C9 8.5 7 10.5 7 14C7 10.5 5 8.5 1 8C5 7.5 7 5.5 7 2Z" />
              <path d="M13 0C13 1.2 13.8 2 15 2C13.8 2 13 2.8 13 4C13 2.8 12.2 2 11 2C12.2 2 13 1.2 13 0Z" opacity="0.55" />
            </svg>
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask Tempo AI to help plan your day..."
              className="flex-1 bg-transparent text-on-surface text-sm outline-none placeholder:text-on-surface-variant/40"
            />
          </form>
        </div>
      )}

      {toastMessage && (
        <CompletionToast message={toastMessage} onDismiss={dismissToast} />
      )}
    </div>
  )
}
