import { useMemo, useState } from 'react'
import { EnergySelector } from '@/components/ui/EnergySelector'
import { TodoItem } from '@/components/ui/TodoItem'
import { useTodos } from '@/hooks/useTodos'
import { scoreTodo } from '@/lib/scoring'
import { usePreferences } from '@/hooks/usePreferences'
import type { EnergyLevel, Todo } from '@/types'

type SortMode = 'score' | 'due' | 'recent'

const SORT_LABELS: Record<SortMode, string> = {
  score: 'Priority',
  due: 'Due date',
  recent: 'Recent',
}

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

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-2.5 cursor-pointer group"
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
        <span className="font-display text-sm font-semibold text-on-surface">
          {name}
        </span>
        <span className="text-xs text-on-surface-variant ml-1">
          {todos.length}
        </span>
      </button>

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
  const { preferences } = usePreferences()
  const [energyFilter, setEnergyFilter] = useState<EnergyLevel | undefined>(undefined)
  const [sortMode, setSortMode] = useState<SortMode>('score')

  const filtered = energyFilter
    ? backlog.filter((t) => t.energy_level === energyFilter)
    : backlog

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

      {/* Controls row */}
      <div className="flex items-start justify-between gap-4 mb-8">
        {/* Energy filter */}
        <div className="flex-1">
          <EnergySelector
            value={energyFilter}
            onChange={(level) =>
              setEnergyFilter(energyFilter === level ? undefined : level)
            }
          />
        </div>

        {/* Sort picker */}
        <div className="flex gap-1.5 flex-shrink-0 pt-0.5">
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
