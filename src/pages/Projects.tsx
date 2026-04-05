import { Link } from 'react-router'
import { useProjects } from '@/hooks/useProjects'

export function ProjectsPage() {
  const { projects, projectCounts, noteCounts } = useProjects()

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Projects
        </h1>
        <p className="text-on-surface-variant text-sm">
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>
      </div>

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
