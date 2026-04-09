import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { TodoItem } from '@/components/ui/TodoItem'
import { FilterDropdown } from '@/components/ui/FilterDropdown'
import { useTodos } from '@/hooks/useTodos'
import { useNotes } from '@/hooks/useNotes'
import { useProjects } from '@/hooks/useProjects'
import { usePreferences } from '@/hooks/usePreferences'
import { scoreTodo } from '@/lib/scoring'
import { ENERGY_LABELS, ENERGY_LEVELS, type EnergyLevel, type Todo } from '@/types'

type SortMode = 'score' | 'due' | 'recent'

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

export function ProjectDetailPage() {
  const { projectSlug } = useParams<{ projectSlug: string }>()
  const projectName = decodeURIComponent(projectSlug ?? '')
  const navigate = useNavigate()

  const { todos, completeTodo, deferTodo, loading } = useTodos()
  const { notes } = useNotes()
  const { projectList, renameProject, deleteProject } = useProjects()
  const { preferences } = usePreferences()

  // Find the project DB object by name
  const projectObj = projectList.find(p => p.name === projectName)

  const [energyFilter, setEnergyFilter] = useState<EnergyLevel | undefined>(undefined)
  const [sortMode, setSortMode] = useState<SortMode>('score')
  const [energyOpen, setEnergyOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // All active (non-done) todos in this project — includes inbox, backlog, pinned, deferred
  const projectTodos = useMemo(
    () => todos.filter((t) => t.project === projectName && t.status !== 'done'),
    [todos, projectName],
  )

  // Total including done
  const totalCount = useMemo(
    () => todos.filter((t) => t.project === projectName).length,
    [todos, projectName],
  )

  // Notes in this project (many-to-many via projects array)
  const projectNotes = useMemo(
    () => notes.filter((n) => (n.projects ?? []).includes(projectName)),
    [notes, projectName],
  )

  const filtered = energyFilter
    ? projectTodos.filter((t) => t.energy_level === energyFilter)
    : projectTodos

  const sorted = useMemo(
    () => sortTodos(filtered, sortMode, preferences.current_energy),
    [filtered, sortMode, preferences.current_energy],
  )

  // Rename project via API (cascades to todos.project automatically)
  const handleRename = async () => {
    const newName = renameValue.trim()
    if (!newName || newName === projectName || !projectObj) {
      setRenaming(false)
      return
    }
    await renameProject(projectObj.id, newName)
    setRenaming(false)
    navigate(`/projects/${encodeURIComponent(newName)}`, { replace: true })
  }

  // Delete project via API (cascades to todos + note_projects)
  const handleDelete = async () => {
    if (!projectObj) return
    await deleteProject(projectObj.id)
    navigate('/projects', { replace: true })
  }

  return (
    <div>
      {/* Back link */}
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-6"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10 4L6 8l4 4" />
        </svg>
        Projects
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-3">
          {renaming ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleRename() }}
              className="flex-1"
            >
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRename}
                autoFocus
                className="w-full bg-transparent font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight outline-none border-b-2 border-primary"
              />
            </form>
          ) : (
            <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight">
              {projectName}
            </h1>
          )}

          {/* Menu trigger */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              aria-label="Project actions"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="4" r="1.5" />
                <circle cx="10" cy="10" r="1.5" />
                <circle cx="10" cy="16" r="1.5" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[160px]">
                  <button
                    onClick={() => {
                      setRenameValue(projectName)
                      setRenaming(true)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    Rename project
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(true)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-error hover:bg-error/5 transition-colors cursor-pointer"
                  >
                    Delete project
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-on-surface-variant text-sm mt-1">
          {projectTodos.length} active todo{projectTodos.length !== 1 ? 's' : ''}
          {projectNotes.length > 0 && ` · ${projectNotes.length} note${projectNotes.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
        <div className="flex-1 min-w-0" />

        <FilterDropdown
          label="Energy"
          options={ENERGY_OPTIONS}
          value={energyFilter}
          clearLabel="All levels"
          open={energyOpen}
          onToggle={() => { setEnergyOpen(!energyOpen); setSortOpen(false) }}
          onClose={() => setEnergyOpen(false)}
          onChange={(level) => setEnergyFilter(level)}
        />

        <FilterDropdown
          label="Sort"
          options={SORT_OPTIONS}
          value={sortMode !== 'score' ? sortMode : undefined}
          open={sortOpen}
          onToggle={() => { setSortOpen(!sortOpen); setEnergyOpen(false) }}
          onClose={() => setSortOpen(false)}
          onChange={(mode) => setSortMode(mode ?? 'score')}
        />

        {energyFilter && (
          <button
            onClick={() => { setEnergyFilter(undefined); setEnergyOpen(false) }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px]"
            title="Clear filters"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
            1
          </button>
        )}
      </div>

      {/* Todo list */}
      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : (
        <>
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

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-on-surface-variant text-sm">
                {energyFilter
                  ? 'No tasks at this energy level.'
                  : projectTodos.length === 0
                    ? 'No active tasks in this project.'
                    : 'Backlog is empty.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Notes section */}
      {projectNotes.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">
            Notes
          </h2>
          <div className="space-y-2">
            {projectNotes.map((n) => (
              <Link
                key={n.id}
                to={`/notes/${n.id}`}
                className="block bg-surface-container-lowest rounded-xl p-4 hover:bg-surface-container-low transition-colors duration-200"
              >
                <h3 className="font-display font-semibold text-on-surface text-sm">
                  {n.title}
                </h3>
                <p className="text-on-surface-variant text-xs mt-0.5">
                  {n.updated_at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />
          <div
            className="relative bg-surface-container-lowest rounded-2xl shadow-xl p-6 mx-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-on-surface mb-2">
              Delete project?
            </h2>
            <p className="text-on-surface-variant text-sm mb-6">
              This will remove the &ldquo;{projectName}&rdquo; label from {totalCount} todo{totalCount !== 1 ? 's' : ''}. The todos themselves won&rsquo;t be deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-error text-on-primary hover:bg-error/90 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
