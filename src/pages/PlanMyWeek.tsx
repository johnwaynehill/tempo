import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useEvents } from '@/hooks/useEvents'
import { useTodos } from '@/hooks/useTodos'
import { usePreferences } from '@/hooks/usePreferences'
import { computeAvailability, OVERCOMMIT_THRESHOLD_MINUTES } from '@/lib/availability'
import { isDueDateGatedProject, scoreTodo } from '@/lib/scoring'
import { getEstimate, formatMinutes, totalEstimatedMinutes, formatClock } from '@/lib/time'
import { dayAbbrev, isSameDay, startOfDay, toISODateString } from '@/lib/dateUtils'
import type { CalendarEvent, Todo } from '@/types'

type Step = 'lookback' | 'plan' | 'ready'

const STEPS: Step[] = ['lookback', 'plan', 'ready']

/** Suggestions shown before "Show more". */
const CANDIDATE_PAGE = 12

/** Today and the six days after it. */
function nextSevenDays(): Date[] {
  const today = startOfDay(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return d
  })
}

function longDayLabel(day: Date): string {
  return day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export function PlanMyWeekPage() {
  const navigate = useNavigate()
  const { todos, pinned, backlog, done, updateTodo, loading: todosLoading } = useTodos()
  const { events, loading: eventsLoading } = useEvents()
  const { preferences } = usePreferences()

  const [step, setStep] = useState<Step>('lookback')
  const stepIndex = STEPS.indexOf(step)

  const days = useMemo(() => nextSevenDays(), [])
  const dayKeys = useMemo(() => days.map(toISODateString), [days])
  const todayKey = dayKeys[0]
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [showAllCandidates, setShowAllCandidates] = useState(false)

  // --- Look back: the last seven days ---

  const lastWeekCompleted = useMemo(() => {
    const since = new Date(days[0])
    since.setDate(since.getDate() - 7)
    return done.filter((t) => t.completed_at && t.completed_at >= since && t.completed_at < days[0])
  }, [done, days])

  const lastWeekTopProjects = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of lastWeekCompleted) {
      const p = t.project || 'Ungrouped'
      counts.set(p, (counts.get(p) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [lastWeekCompleted])

  // Planned for a day that has passed and still open: offered first when placing todos.
  const carriedOver = useMemo(
    () => todos.filter((t) => t.status !== 'done' && t.planned_date && t.planned_date < todayKey),
    [todos, todayKey],
  )

  // --- Each day of the week ahead ---

  const plannedByDay = useMemo(() => {
    const map: Record<string, Todo[]> = {}
    for (const key of dayKeys) map[key] = []
    for (const t of todos) {
      if (t.status === 'done' || !t.planned_date) continue
      map[t.planned_date]?.push(t)
    }
    return map
  }, [todos, dayKeys])

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const key of dayKeys) map[key] = []
    for (const e of events) map[toISODateString(e.start_time)]?.push(e)
    for (const key of dayKeys) {
      map[key].sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.start_time.getTime() - b.start_time.getTime())
    }
    return map
  }, [events, dayKeys])

  const dueByDay = useMemo(() => {
    const map: Record<string, Todo[]> = {}
    for (const key of dayKeys) map[key] = []
    for (const t of todos) {
      if (t.status === 'done' || !t.due_date) continue
      map[toISODateString(t.due_date)]?.push(t)
    }
    return map
  }, [todos, dayKeys])

  // Already on Today without being planned for it (pinned by hand or by the morning auto-plan).
  const onTodayUnplanned = useMemo(() => pinned.filter((t) => t.planned_date !== todayKey), [pinned, todayKey])

  /** Free working minutes and planned minutes for a day. Today counts from now. */
  const loadFor = useCallback((key: string, day: Date) => {
    const availability = computeAvailability({
      now: key === todayKey ? new Date() : day,
      dayStart: preferences.work_day_start,
      dayEnd: preferences.work_day_end,
      events: eventsByDay[key],
    })
    const planned = plannedByDay[key]
    const plannedMinutes = totalEstimatedMinutes(key === todayKey ? [...onTodayUnplanned, ...planned] : planned)
    return { freeMinutes: availability.freeMinutes, plannedMinutes }
  }, [todayKey, preferences.work_day_start, preferences.work_day_end, eventsByDay, plannedByDay, onTodayUnplanned])

  const selectedIndex = Math.max(0, dayKeys.indexOf(selectedKey))
  const selectedDay = days[selectedIndex]
  const selectedLoad = loadFor(selectedKey, selectedDay)
  const isOver = (load: { freeMinutes: number; plannedMinutes: number }) =>
    load.plannedMinutes - load.freeMinutes > OVERCOMMIT_THRESHOLD_MINUTES

  // Backlog todos not yet planned this week. Chores are left out: their due date already
  // decides their day. Carried-over todos lead, then the rest by the usual score.
  const candidates = useMemo(() => {
    const plannedThisWeek = new Set(dayKeys)
    const energy = preferences.current_energy
    const pool = backlog.filter(
      (t) => !isDueDateGatedProject(t.project) && !(t.planned_date && plannedThisWeek.has(t.planned_date)),
    )
    const carried = pool.filter((t) => t.planned_date && t.planned_date < todayKey)
    const rest = pool
      .filter((t) => !(t.planned_date && t.planned_date < todayKey))
      .map((todo) => ({ todo, score: scoreTodo(todo, energy) }))
      .sort((a, b) => b.score - a.score)
      .map((s) => s.todo)
    return [...carried, ...rest]
  }, [backlog, dayKeys, todayKey, preferences.current_energy])

  const visibleCandidates = showAllCandidates ? candidates : candidates.slice(0, CANDIDATE_PAGE)

  // Planning for today also puts it on Today: this morning's auto-plan has already run.
  const planFor = useCallback((todo: Todo, key: string) => {
    const updates: Partial<Todo> = { planned_date: key }
    if (key === todayKey && todo.status === 'backlog') updates.status = 'today_pinned'
    void updateTodo(todo.id, updates)
  }, [todayKey, updateTodo])

  const unplan = useCallback((todo: Todo) => {
    const updates: Partial<Todo> = { planned_date: undefined }
    if (todo.planned_date === todayKey && todo.status === 'today_pinned') updates.status = 'backlog'
    void updateTodo(todo.id, updates)
  }, [todayKey, updateTodo])

  const plannedCount = dayKeys.reduce((n, key) => n + plannedByDay[key].length, 0)

  const handleNext = () => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)])
  const handleBack = () => setStep(STEPS[Math.max(stepIndex - 1, 0)])

  if (todosLoading || eventsLoading) {
    return (
      <div className="min-h-dvh bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => navigate('/today')}
          className="text-on-surface-variant text-sm hover:text-on-surface transition-colors cursor-pointer"
        >
          {step === 'ready' ? 'Close' : 'Skip'}
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

      <div className={`flex-1 flex flex-col items-center px-6 max-w-lg mx-auto w-full ${step === 'plan' ? 'pt-2' : 'justify-center'}`}>

        {/* Step 1: Look back */}
        {step === 'lookback' && (
          <div className="w-full animate-gentle-appear">
            <div className="text-center mb-8">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-2">
                {lastWeekCompleted.length === 0 ? 'A fresh week' : 'The last seven days'}
              </h1>
              <p className="text-on-surface-variant text-sm">
                {lastWeekCompleted.length === 0
                  ? 'Nothing completed in the last seven days. No judgment, this is a new week.'
                  : `You completed ${lastWeekCompleted.length} task${lastWeekCompleted.length !== 1 ? 's' : ''}. Nice.`}
              </p>
            </div>

            {lastWeekTopProjects.length > 0 && (
              <div className="space-y-1.5 mb-6">
                {lastWeekTopProjects.map(([project, count]) => (
                  <div key={project} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low">
                    <span className="text-sm text-on-surface truncate flex-1">{project}</span>
                    <span className="text-xs text-on-surface-variant tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {carriedOver.length > 0 && (
              <p className="text-on-surface-variant text-sm text-center">
                {carriedOver.length} planned task{carriedOver.length !== 1 ? 's' : ''} didn&rsquo;t happen on {carriedOver.length !== 1 ? 'their' : 'its'} day.
                {' '}{carriedOver.length !== 1 ? 'They' : 'It'}&rsquo;ll be first in the list to place again.
              </p>
            )}
          </div>
        )}

        {/* Step 2: Plan each day */}
        {step === 'plan' && (
          <div className="w-full animate-gentle-appear">
            <div className="text-center mb-5">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-2">
                Plan your week
              </h1>
              <p className="text-on-surface-variant text-sm">
                Pick a day, then add what you&rsquo;d like to do on it.
              </p>
            </div>

            {/* Day strip */}
            <div className="grid grid-cols-7 gap-1 mb-5" role="tablist" aria-label="Days">
              {days.map((day, i) => {
                const key = dayKeys[i]
                const selected = key === selectedKey
                const load = loadFor(key, day)
                const fill = load.freeMinutes > 0 ? Math.min(1, load.plannedMinutes / load.freeMinutes) : load.plannedMinutes > 0 ? 1 : 0
                return (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={selected}
                    aria-label={`${longDayLabel(day)}, ${plannedByDay[key].length} planned`}
                    onClick={() => { setSelectedKey(key); setShowAllCandidates(false) }}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl cursor-pointer transition-colors min-h-[44px] ${
                      selected ? 'bg-primary/10' : 'hover:bg-surface-container'
                    }`}
                  >
                    <span className={`text-[11px] ${selected ? 'text-primary font-medium' : 'text-on-surface-variant'}`}>
                      {i === 0 ? 'Today' : dayAbbrev(day)}
                    </span>
                    <span className={`text-sm tabular-nums ${selected ? 'text-primary font-semibold' : 'text-on-surface'}`}>
                      {day.getDate()}
                    </span>
                    <span className="w-6 h-1 rounded-full bg-surface-container-high overflow-hidden">
                      <span
                        className={`block h-full rounded-full ${isOver(load) ? 'bg-error/70' : 'bg-primary'}`}
                        style={{ width: `${fill * 100}%` }}
                      />
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Selected day */}
            <div className="mb-5">
              <div className="flex items-baseline justify-between gap-3 mb-1 px-1">
                <h2 className="font-display text-base font-semibold text-on-surface">
                  {longDayLabel(selectedDay)}
                </h2>
                <span className="text-xs text-on-surface-variant tabular-nums shrink-0">
                  {formatMinutes(selectedLoad.plannedMinutes)} planned &middot; {formatMinutes(selectedLoad.freeMinutes)} free
                </span>
              </div>
              {isOver(selectedLoad) && (
                <p className="text-xs text-on-surface-variant px-1 mb-2">
                  That&rsquo;s more than the free time. Maybe move something to a lighter day?
                </p>
              )}

              {eventsByDay[selectedKey].length > 0 && (
                <ul className="mt-2 space-y-1">
                  {eventsByDay[selectedKey].map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-surface-container-lowest text-sm">
                      <span className="text-xs text-on-surface-variant w-16 shrink-0 tabular-nums">
                        {e.all_day ? 'All day' : formatClock(e.start_time)}
                      </span>
                      <span className="text-on-surface truncate">{e.title}</span>
                    </li>
                  ))}
                </ul>
              )}

              {dueByDay[selectedKey].length > 0 && (
                <ul className="mt-2 space-y-1">
                  {dueByDay[selectedKey].map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-surface-container-lowest text-sm">
                      <span className="text-xs text-on-surface-variant w-16 shrink-0">Due</span>
                      <span className="text-on-surface truncate">{t.title}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 space-y-1.5">
                {selectedKey === todayKey && onTodayUnplanned.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low">
                    <span className="text-sm text-on-surface truncate flex-1">{t.title}</span>
                    <span className="text-xs text-on-surface-variant shrink-0">On Today</span>
                  </div>
                ))}
                {plannedByDay[selectedKey].map((t) => (
                  <div key={t.id} className="flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-xl bg-primary/8">
                    <span className="text-sm text-on-surface truncate flex-1">{t.title}</span>
                    <span className="text-xs text-on-surface-variant shrink-0 tabular-nums">{formatMinutes(getEstimate(t))}</span>
                    <button
                      onClick={() => unplan(t)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer shrink-0"
                      aria-label={`Remove ${t.title} from ${dayAbbrev(selectedDay)}`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </div>
                ))}
                {plannedByDay[selectedKey].length === 0 && (selectedKey !== todayKey || onTodayUnplanned.length === 0) && (
                  <p className="text-sm text-on-surface-variant/70 px-1 py-2">Nothing planned yet.</p>
                )}
              </div>
            </div>

            {/* Candidates */}
            {candidates.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-2 px-1">
                  Add to {selectedKey === todayKey ? 'today' : dayAbbrev(selectedDay)}
                </p>
                <div className="space-y-1.5">
                  {visibleCandidates.map((todo) => {
                    const carried = !!todo.planned_date && todo.planned_date < todayKey
                    return (
                      <button
                        key={todo.id}
                        onClick={() => planFor(todo, selectedKey)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low text-left cursor-pointer transition-colors hover:bg-surface-container"
                      >
                        <svg className="w-4 h-4 text-on-surface-variant shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M8 3v10M3 8h10" />
                        </svg>
                        <span className="text-sm text-on-surface truncate flex-1">{todo.title}</span>
                        {carried ? (
                          <span className="text-xs text-on-surface-variant shrink-0">Carried over</span>
                        ) : todo.due_date ? (
                          <span className={`text-xs shrink-0 ${isSameDay(todo.due_date, selectedDay) ? 'text-primary' : 'text-on-surface-variant'}`}>
                            Due {todo.due_date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        ) : null}
                        <span className="text-xs text-on-surface-variant shrink-0 tabular-nums">
                          {formatMinutes(getEstimate(todo))}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {!showAllCandidates && candidates.length > CANDIDATE_PAGE && (
                  <button
                    onClick={() => setShowAllCandidates(true)}
                    className="mt-2 w-full py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    Show {candidates.length - CANDIDATE_PAGE} more
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Ready */}
        {step === 'ready' && (
          <div className="w-full animate-gentle-appear">
            <div className="text-center mb-8">
              <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12l5 5L19 7" />
                </svg>
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-2">
                Your week is set
              </h1>
              <p className="text-on-surface-variant text-sm">
                {plannedCount === 0
                  ? 'Nothing planned for a particular day. Each morning will pick from your backlog as usual.'
                  : `${plannedCount} task${plannedCount !== 1 ? 's' : ''} planned. Each lands on Today on its day.`}
              </p>
            </div>

            {plannedCount > 0 && (
              <div className="space-y-1.5">
                {days.map((day, i) => {
                  const key = dayKeys[i]
                  const planned = plannedByDay[key]
                  if (planned.length === 0) return null
                  return (
                    <div key={key} className="px-4 py-3 rounded-xl bg-surface-container-low">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-on-surface">{i === 0 ? 'Today' : longDayLabel(day)}</span>
                        <span className="text-xs text-on-surface-variant tabular-nums">{formatMinutes(totalEstimatedMinutes(planned))}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                        {planned.map((t) => t.title).join(' · ')}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="sticky bottom-0 bg-surface px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-3 max-w-lg mx-auto w-full">
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
            onClick={() => navigate('/today')}
            className="px-8 py-3 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px]"
          >
            Go to Today
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-8 py-3 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px]"
          >
            {step === 'plan' ? 'Done' : 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}
