import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useProjects } from '@/hooks/useProjects'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { MenuButton } from '@/components/ui/MenuButton'

export function ProjectsPage() {
  const { projects, projectCounts, noteCounts } = useProjects()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    await api.projects.create(name)
    qc.invalidateQueries({ queryKey: ['projects'] })
    setNewName('')
    setShowNew(false)
    navigate(`/projects/${encodeURIComponent(name)}`)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Projects
          </h1>
          <p className="text-on-surface-variant text-sm">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowNew(true)}
            className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="New project"
            title="New project"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <MenuButton />
        </div>
      </div>

      {/* New project inline form */}
      {showNew && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleCreate() }}
          className="mb-6 flex items-center gap-2"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            autoFocus
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-lowest text-on-surface text-sm outline-none border border-outline-variant/30 focus:border-primary transition-colors min-h-[44px]"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => { setShowNew(false); setNewName('') }}
            className="px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer min-h-[44px]"
          >
            Cancel
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-on-surface-variant text-sm">
            No projects yet. Assign a project to a todo or note to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map((project) => {
            const todoCount = projectCounts[project] ?? 0
            const noteCount = noteCounts[project] ?? 0

            return (
              <Link
                key={project}
                to={`/projects/${encodeURIComponent(project)}`}
                className="block bg-surface-container-lowest rounded-xl p-5 hover:bg-surface-container-low transition-colors duration-200"
              >
                <h3 className="font-display font-semibold text-on-surface text-[15px] mb-2">
                  {project}
                </h3>
                <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                  {todoCount > 0 && (
                    <span>{todoCount} todo{todoCount !== 1 ? 's' : ''}</span>
                  )}
                  {noteCount > 0 && (
                    <span>{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
                  )}
                  {todoCount === 0 && noteCount === 0 && (
                    <span>No active items</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
