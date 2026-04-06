import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { EnergySelector } from '@/components/ui/EnergySelector'
import { useTodos } from '@/hooks/useTodos'
import { usePreferences } from '@/hooks/usePreferences'
import { suggestTodayTodos } from '@/lib/scoring'
import { defaultEstimate, formatMinutes } from '@/hooks/useTimer'
import { api } from '@/lib/api'
import type { Todo, EnergyLevel } from '@/types'

type Step = 'energy' | 'yesterday' | 'pick' | 'estimates' | 'ready'

const STEPS: Step[] = ['energy', 'yesterday', 'pick', 'estimates', 'ready']

function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getEstimate(todo: Todo): number {
  return todo.estimated_minutes ?? defaultEstimate(todo.size)
}

export function PlanMyDayPage() {
  const navigate = useNavigate()
  const { todos, pinned, backlog, done, pinToToday, updateTodo, loading: todosLoading } = useTodos()
  const { preferences, updatePreferences } = usePreferences()

  const [step, setStep] = useState<Step>('energy')
  const [energy, setEnergy] = useState<EnergyLevel | undefined>(preferences.current_energy)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(pinned.map((t) => t.id)))
  const [initialized, setInitialized] = useState(false)

  const stepIndex = STEPS.indexOf(step)

  // Yesterday's completed tasks
  const yesterdayCompleted = useMemo(() => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return done.filter((t) => t.completed_at && t.completed_at >= yesterday && t.completed_at < today)
  }, [done])

  // Suggested todos based on energy
  const suggestions = useMemo(() => {
    return suggestTodayTodos(todos, energy, 0, 8)
  }, [todos, energy])

  // Initialize selected set once todos load — include pinned + top suggestions
  if (!initialized && !todosLoading && todos.length > 0) {
    const pinnedIds = new Set(pinned.map((t) => t.id))
    const suggested = suggestTodayTodos(todos, energy, pinned.length, 5)
    const initial = new Set([...pinnedIds, ...suggested.map((t) => t.id)])
    setSelectedIds(initial)
    setInitialized(true)
  }

  // The selected todos as objects (preserving order: pinned first, then selected)
  const selectedTodos = useMemo(() => {
    const todoMap = new Map(todos.map((t) => [t.id, t]))
    const pinnedIds = new Set(pinned.map((t) => t.id))
    const result: Todo[] = []

    // Pinned first
    for (const id of selectedIds) {
      if (pinnedIds.has(id)) {
        const t = todoMap.get(id)
        if (t) result.push(t)
      }
    }
    // Then others
    for (const id of selectedIds) {
      if (!pinnedIds.has(id)) {
        const t = todoMap.get(id)
        if (t) result.push(t)
      }
    }
    return result
  }, [selectedIds, todos, pinned])

  // Backlog candidates not already selected
  const backlogCandidates = useMemo(() => {
    return [...suggestions, ...backlog]
      .filter((t) => !selectedIds.has(t.id))
      .filter((t, i, arr) => arr.findIndex((a) => a.id === t.id) === i) // dedupe
      .slice(0, 10)
  }, [suggestions, backlog, selectedIds])

  // Total time estimate
  const totalMinutes = useMemo(() => {
    return selectedTodos.reduce((sum, t) => sum + getEstimate(t), 0)
  }, [selectedTodos])

  const endTime = useMemo(() => {
    const end = new Date(Date.now() + totalMinutes * 60 * 1000)
    return end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }, [totalMinutes])

  const toggleTodo = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 5) {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleNext = useCallback(() => {
    const i = STEPS.indexOf(step)
    if (i < STEPS.length - 1) {
      // When leaving energy step, persist the energy choice
      if (step === 'energy' && energy) {
        updatePreferences({ current_energy: energy })
      }
      setStep(STEPS[i + 1])
    }
  }, [step, energy, updatePreferences])

  const handleBack = useCallback(() => {
    const i = STEPS.indexOf(step)
    if (i > 0) {
      setStep(STEPS[i - 1])
    }
  }, [step])

  const handleFinish = useCallback(async () => {
    // Pin all selected, update today set, navigate to Today
    const pinnedIds = new Set(pinned.map((t) => t.id))
    const newPins = [...selectedIds].filter((id) => !pinnedIds.has(id))

    for (const id of newPins) {
      await pinToToday(id)
    }

    // Update the today set with all selected IDs
    await api.todaySet.update({
      date: todayDateString(),
      todoIds: [...selectedIds],
    })

    navigate('/today')
  }, [selectedIds, pinned, pinToToday, navigate])

  if (todosLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => navigate('/today')}
          className="text-on-surface-variant text-sm hover:text-on-surface transition-colors cursor-pointer"
        >
          Skip
        </button>
        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                i <= stepIndex ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            />
          ))}
        </div>
        <span className="text-on-surface-variant text-xs w-8 text-right">
          {stepIndex + 1}/{STEPS.length}
        </span>
      </div>

      {/* Main content — centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full">

        {/* Step 1: Energy */}
        {step === 'energy' && (
          <div className="w-full animate-gentle-appear">
            <div className="text-center mb-8">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-2">
                Good morning
              </h1>
              <p className="text-on-surface-variant text-sm">
                How's your energy right now?
              </p>
            </div>
            <div className="flex justify-center">
              <EnergySelector
                value={energy}
                onChange={(level) => setEnergy(energy === level ? undefined : level)}
              />
            </div>
          </div>
        )}

        {/* Step 2: Yesterday review */}
        {step === 'yesterday' && (
          <div className="w-full animate-gentle-appear">
            <div className="text-center mb-8">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-2">
                {yesterdayCompleted.length === 0 ? 'Fresh start' : 'Yesterday'}
              </h1>
              <p className="text-on-surface-variant text-sm">
                {yesterdayCompleted.length === 0
                  ? 'No tasks completed yesterday. No judgment — today is a new day.'
                  : `You completed ${yesterdayCompleted.length} task${yesterdayCompleted.length !== 1 ? 's' : ''} yesterday. Nice.`}
              </p>
            </div>
            {yesterdayCompleted.length > 0 && (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {yesterdayCompleted.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low"
                  >
                    <svg className="w-4 h-4 text-primary flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 8l3.5 3.5L13 4.5" />
                    </svg>
                    <span className="text-sm text-on-surface truncate">{todo.title}</span>
                    {todo.project && (
                      <span className="text-xs text-on-surface-variant ml-auto flex-shrink-0">{todo.project}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Pick tasks */}
        {step === 'pick' && (
          <div className="w-full animate-gentle-appear">
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-2">
                Pick your tasks
              </h1>
              <p className="text-on-surface-variant text-sm">
                Choose up to 5 tasks for today. {selectedIds.size}/5 selected.
              </p>
            </div>

            {/* Selected tasks */}
            {selectedTodos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-2 px-1">
                  Today's tasks
                </p>
                <div className="space-y-1.5">
                  {selectedTodos.map((todo) => (
                    <button
                      key={todo.id}
                      onClick={() => toggleTodo(todo.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/8 text-left cursor-pointer transition-colors hover:bg-primary/12"
                    >
                      <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-on-primary" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M2.5 6L5 8.5L9.5 3.5" />
                        </svg>
                      </div>
                      <span className="text-sm text-on-surface truncate flex-1">{todo.title}</span>
                      <span className="text-xs text-on-surface-variant flex-shrink-0">
                        {formatMinutes(getEstimate(todo))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Available tasks */}
            {backlogCandidates.length > 0 && selectedIds.size < 5 && (
              <div>
                <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-2 px-1">
                  Suggestions
                </p>
                <div className="space-y-1.5 max-h-[30vh] overflow-y-auto">
                  {backlogCandidates.map((todo) => (
                    <button
                      key={todo.id}
                      onClick={() => toggleTodo(todo.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low text-left cursor-pointer transition-colors hover:bg-surface-container"
                    >
                      <div className="w-5 h-5 rounded-md border-2 border-outline-variant/40 flex-shrink-0" />
                      <span className="text-sm text-on-surface truncate flex-1">{todo.title}</span>
                      {todo.due_date && (
                        <span className="text-xs text-on-surface-variant flex-shrink-0">
                          {todo.due_date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Time estimates */}
        {step === 'estimates' && (
          <div className="w-full animate-gentle-appear">
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-2">
                Time check
              </h1>
              <p className="text-on-surface-variant text-sm">
                Set estimates for your tasks. Total: {formatMinutes(totalMinutes)}
              </p>
            </div>

            <div className="space-y-4">
              {selectedTodos.map((todo) => (
                <div key={todo.id} className="px-4 py-3 rounded-xl bg-surface-container-low">
                  <p className="text-sm text-on-surface font-medium mb-2 truncate">{todo.title}</p>
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                    {[5, 15, 25, 45, 60, 90].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => updateTodo(todo.id, { estimated_minutes: todo.estimated_minutes === mins ? undefined : mins })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 min-h-[36px] ${
                          todo.estimated_minutes === mins
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Ready */}
        {step === 'ready' && (
          <div className="w-full animate-gentle-appear text-center">
            <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12l5 5L19 7" />
              </svg>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-2">
              Your day is set
            </h1>
            <p className="text-on-surface-variant text-sm mb-2">
              {selectedTodos.length} task{selectedTodos.length !== 1 ? 's' : ''} &middot; {formatMinutes(totalMinutes)} total
            </p>
            <p className="text-on-surface-variant text-sm">
              Done by ~{endTime}
            </p>

            <div className="mt-8 space-y-2">
              {selectedTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low"
                >
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm text-on-surface truncate flex-1">{todo.title}</span>
                  <span className="text-xs text-on-surface-variant flex-shrink-0">
                    {formatMinutes(getEstimate(todo))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-3">
        {stepIndex > 0 && step !== 'ready' && (
          <button
            onClick={handleBack}
            className="px-5 py-3 rounded-xl bg-surface-container text-on-surface-variant text-sm font-medium hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer min-h-[44px]"
          >
            Back
          </button>
        )}
        <div className="flex-1" />
        {step === 'ready' ? (
          <button
            onClick={handleFinish}
            className="px-8 py-3 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px]"
          >
            Start my day
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-8 py-3 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px]"
          >
            {step === 'energy' && !energy ? 'Skip' : 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}
