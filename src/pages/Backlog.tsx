import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EnergySelector } from '@/components/ui/EnergySelector'
import { TodoItem } from '@/components/ui/TodoItem'
import { useTodos } from '@/hooks/useTodos'
import { useProjects } from '@/hooks/useProjects'
import { scoreTodo } from '@/lib/scoring'
import { usePreferences } from '@/hooks/usePreferences'
import { ENERGY_LABELS, ENERGY_LEVELS, type EnergyLevel, type Todo } from '@/types'
import { FilterDropdown } from '@/components/ui/FilterDropdown'

type SortMode = 'score' | 'due' | 'recent'

const SORT_LABELS: Record<SortMode, string> = {
  score: 'Priority',
  due: 'Due date',
  recent: 'Recent',
}

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
        // Items with due dates first, then by date ascending
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

function ProjectGroup({
  name,
  todos,
  defaultOpen,
  onComplete,
  onDefer,
}: {
  name: string
  todos: Todo[]
  defaultOpen: boolean
  onComplete: (id: string) => void
  onDefer: (id: string, until?: Date) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isUngrouped = name === 'Ungrouped'

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 py-2.5 group">
        {/* Chevron toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="cursor-pointer p-0.5"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`w-3.5 h-3.5 text-on-surface-variant transition-transform duration-200 ${
              open ? 'rotate-90' : ''
            }`}
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M4 2l5 4-5 4V2z" />
          </svg>
        </button>

        {/* Project name — links to project page (except Ungrouped) */}
        {isUngrouped ? (
          <span className="font-display text-sm font-semibold text-on-surface">
            {name}
          </span>
        ) : (
          <Link
            to={`/projects/${encodeURIComponent(name)}`}
            className="font-display text-sm font-semibold text-on-surface hover:text-primary transition-colors"
          >
            {name}
          </Link>
        )}

        <span className="text-xs text-on-surface-variant ml-1">
          {todos.length}
        </span>
      </div>

      {open && (
        <div className="space-y-0 ml-1">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onComplete={onComplete}
              onDefer={onDefer}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function BacklogPage() {
  const { backlog, completeTodo, deferTodo, loading } = useTodos()
  const { projects, projectCounts } = useProjects()
  const { preferences } = usePreferences()
  const [energyFilter, setEnergyFilter] = useState<EnergyLevel | undefined>(undefined)
  const [projectFilter, setProjectFilter] = useState<string | undefined>(undefined)
  const [sortMode, setSortMode] = useState<SortMode>('score')
  const [energyOpen, setEnergyOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)

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

    // Named projects first (alphabetical), ungrouped last
    const entries = [...map.entries()].sort((a, b) => {
      if (a[0] === 'Ungrouped') return 1
      if (b[0] === 'Ungrouped') return -1
      return a[0].localeCompare(b[0])
    })

    return entries
  }, [sorted])

  const hasMultipleGroups = groups.length > 1

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Backlog
        </h1>
        <p className="text-on-surface-variant text-sm">
          {backlog.length} total &middot; {filtered.length} showing
        </p>
      </div>

      {/* Mobile filter menus */}
      <div className="sm:hidden flex gap-2 mb-6 flex-wrap">
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
        <FilterDropdown
          label="Sort"
          options={SORT_OPTIONS}
          value={sortMode !== 'score' ? sortMode : undefined}
          open={sortOpen}
          onToggle={() => { setSortOpen(!sortOpen); setEnergyOpen(false); setProjectOpen(false) }}
          onClose={() => setSortOpen(false)}
          onChange={(mode) => setSortMode(mode ?? 'score')}
        />
      </div>

      {/* Desktop: always-visible controls */}
      <div className="hidden sm:flex sm:flex-col sm:gap-4 mb-8">
        {/* Project filter pills */}
        {projects.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setProjectFilter(undefined)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                !projectFilter
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
            >
              All
            </button>
            {projects.map((name) => (
              <button
                key={name}
                onClick={() => setProjectFilter(projectFilter === name ? undefined : name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                  projectFilter === name
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {name}
                {(projectCounts[name] ?? 0) > 0 && (
                  <span className="ml-1 opacity-60">{projectCounts[name]}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Energy + Sort row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <EnergySelector
              value={energyFilter}
              onChange={(level) =>
                setEnergyFilter(energyFilter === level ? undefined : level)
              }
            />
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {(['score', 'due', 'recent'] as SortMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                  sortMode === mode
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {SORT_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : (
        <>
          {hasMultipleGroups ? (
            // Grouped view — collapsible project sections
            groups.map(([name, todos]) => (
              <ProjectGroup
                key={name}
                name={name}
                todos={todos}
                defaultOpen={groups.length <= 3}
                onComplete={completeTodo}
                onDefer={deferTodo}
              />
            ))
          ) : (
            // Flat view — only one group or no projects set
            <div className="space-y-0">
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
                {energyFilter ? 'No tasks at this energy level.' : 'Backlog is empty.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
