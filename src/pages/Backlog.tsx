import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { TodoItem } from '@/components/ui/TodoItem'
import { TodoDetailDrawer } from '@/components/ui/TodoDetailDrawer'
import { MenuButton } from '@/components/ui/MenuButton'
import { useTodos } from '@/hooks/useTodos'
import { useNewTodo } from '@/hooks/useNewTodo'
import { useProjects } from '@/hooks/useProjects'
import { scoreTodo } from '@/lib/scoring'
import { usePreferences } from '@/hooks/usePreferences'
import { ENERGY_LABELS, ENERGY_LEVELS, type EnergyLevel, type Todo } from '@/types'
import { FilterDropdown } from '@/components/ui/FilterDropdown'
import { CalendarView } from '@/components/backlog/CalendarView'

type SortMode = 'score' | 'due' | 'recent'
type ViewMode = 'list' | 'calendar'

const ENERGY_OPTIONS = ENERGY_LEVELS.map((level) => ({ value: level, label: ENERGY_LABELS[level] }))
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'score', label: 'Priority' },
  { value: 'due', label: 'Due date' },
  { value: 'recent', label: 'Recent' },
]

function sortTodos(todos: Todo[], mode: SortMode, energy?: EnergyLevel): Todo[] {
  const sorted = [...todos]
  switch (mode) {
    case 'score':
      sorted.sort((a, b) => scoreTodo(b, energy) - scoreTodo(a, energy))
      break
    case 'due':
      sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.getTime() - b.due_date.getTime()
      })
      break
    case 'recent':
      sorted.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      break
  }
  return sorted
}

function ProjectSection({
  name,
  todos,
  onComplete,
  onDefer,
}: {
  name: string
  todos: Todo[]
  onComplete: (id: string) => void
  onDefer: (id: string, until?: Date) => void
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className="font-display text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          {name}
        </span>
        <span className="text-xs text-on-surface-variant/50">
          {todos.length}
        </span>
      </div>
      <div className="space-y-3">
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onComplete={onComplete}
            onDefer={onDefer}
          />
        ))}
      </div>
    </div>
  )
}

export function BacklogPage() {
  const { backlog, completeTodo, deferTodo, loading } = useTodos()
  const { projects, projectCounts } = useProjects()
  const { preferences } = usePreferences()

  // Filter/sort/view state is mirrored to URL search params so that navigating
  // away (e.g. into a todo detail) and back via `navigate(-1)` restores the
  // exact filter context. Also makes filtered views URL-shareable.
  const [searchParams, setSearchParams] = useSearchParams()

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (searchParams.get('view') === 'calendar' ? 'calendar' : 'list'),
  )
  const [energyFilter, setEnergyFilter] = useState<EnergyLevel | undefined>(() => {
    const v = searchParams.get('energy')
    return v && (ENERGY_LEVELS as readonly string[]).includes(v) ? (v as EnergyLevel) : undefined
  })
  const [projectFilter, setProjectFilter] = useState<string | undefined>(
    () => searchParams.get('project') ?? undefined,
  )
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const v = searchParams.get('sort')
    return v === 'due' || v === 'recent' ? v : 'score'
  })

  // Sync state back to URL — `replace: true` so toggling a filter doesn't
  // pollute history. Default values are omitted to keep the URL clean.
  useEffect(() => {
    const params = new URLSearchParams()
    if (energyFilter) params.set('energy', energyFilter)
    if (projectFilter) params.set('project', projectFilter)
    if (sortMode !== 'score') params.set('sort', sortMode)
    if (viewMode !== 'list') params.set('view', viewMode)
    setSearchParams(params, { replace: true })
  }, [energyFilter, projectFilter, sortMode, viewMode, setSearchParams])

  const { newTodo, createTodo, closeNewTodo } = useNewTodo('backlog', {
    project: projectFilter,
    energy_level: energyFilter,
  })
  const [energyOpen, setEnergyOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)

  const closeAllDropdowns = () => {
    setEnergyOpen(false)
    setSortOpen(false)
    setProjectOpen(false)
  }

  const PROJECT_OPTIONS = projects.map((name) => ({
    value: name,
    label: `${name} (${projectCounts[name] ?? 0})`,
  }))

  const filtered = backlog.filter((t) => {
    if (energyFilter && t.energy_level !== energyFilter) return false
    if (projectFilter && t.project !== projectFilter) return false
    return true
  })

  const sorted = useMemo(
    () => sortTodos(filtered, sortMode, preferences.current_energy),
    [filtered, sortMode, preferences.current_energy],
  )

  // Group by project
  const groups = useMemo(() => {
    const map = new Map<string, Todo[]>()

    for (const todo of sorted) {
      const key = todo.project || 'Ungrouped'
      const list = map.get(key) ?? []
      list.push(todo)
      map.set(key, list)
    }

    const entries = [...map.entries()].sort((a, b) => {
      if (a[0] === 'Ungrouped') return 1
      if (b[0] === 'Ungrouped') return -1
      return a[0].localeCompare(b[0])
    })

    return entries
  }, [sorted])

  const hasMultipleGroups = groups.length > 1

  // Count active filters for badge
  const activeFilterCount = (energyFilter ? 1 : 0) + (projectFilter ? 1 : 0)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Backlog
          </h1>
          <p className="text-on-surface-variant text-sm">
            {backlog.length} total{viewMode === 'list' && <> &middot; {filtered.length} showing</>}
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

      {/* Unified toolbar */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {/* View toggle — segmented control */}
        <div className="flex rounded-xl bg-surface-container-high p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer min-h-[44px] ${
              viewMode === 'list'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 3h10M2 7h10M2 11h10" />
            </svg>
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer min-h-[44px] ${
              viewMode === 'calendar'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="2" width="12" height="11" rx="1.5" />
              <path d="M1 5.5h12" />
              <path d="M4.5 1v2M9.5 1v2" />
            </svg>
            Cal
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Filter dropdowns */}
        {projects.length > 0 && (
          <FilterDropdown
            label="Project"
            options={PROJECT_OPTIONS}
            value={projectFilter}
            clearLabel="All projects"
            open={projectOpen}
            onToggle={() => { setProjectOpen(!projectOpen); setEnergyOpen(false); setSortOpen(false) }}
            onClose={() => setProjectOpen(false)}
            onChange={(project) => setProjectFilter(project)}
          />
        )}

        <FilterDropdown
          label="Energy"
          options={ENERGY_OPTIONS}
          value={energyFilter}
          clearLabel="All levels"
          open={energyOpen}
          onToggle={() => { setEnergyOpen(!energyOpen); setSortOpen(false); setProjectOpen(false) }}
          onClose={() => setEnergyOpen(false)}
          onChange={(level) => setEnergyFilter(level)}
        />

        {viewMode === 'list' && (
          <FilterDropdown
            label="Sort"
            options={SORT_OPTIONS}
            value={sortMode !== 'score' ? sortMode : undefined}
            open={sortOpen}
            onToggle={() => { setSortOpen(!sortOpen); setEnergyOpen(false); setProjectOpen(false) }}
            onClose={() => setSortOpen(false)}
            onChange={(mode) => setSortMode(mode ?? 'score')}
          />
        )}

        {/* Active filter indicator */}
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setEnergyFilter(undefined); setProjectFilter(undefined); closeAllDropdowns() }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px]"
            title="Clear all filters"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
            {activeFilterCount}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : viewMode === 'calendar' ? (
        <CalendarView
          todos={filtered}
          onCompleteTodo={completeTodo}
          onDeferTodo={deferTodo}
        />
      ) : (
        <>
          {hasMultipleGroups ? (
            groups.map(([name, todos]) => (
              <ProjectSection
                key={name}
                name={name}
                todos={todos}
                onComplete={completeTodo}
                onDefer={deferTodo}
              />
            ))
          ) : (
            <div className="space-y-3">
              {sorted.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onComplete={completeTodo}
                  onDefer={deferTodo}
                />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-on-surface-variant text-sm">
                {activeFilterCount > 0 ? 'No tasks match these filters.' : 'Backlog is empty.'}
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
