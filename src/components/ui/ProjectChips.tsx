interface ProjectChipsProps {
  value: string | null
  projects: string[]
  onChange: (project: string | null) => void
}

/**
 * Flat selection of existing projects, rendered as tappable chips. Designed
 * for quick-capture flows where pulling up a menu or bottom sheet adds
 * friction — the projects are right there as one-tap targets.
 *
 * - Tap an unselected chip to select.
 * - Tap the selected chip again to clear.
 * - Wraps to multiple lines if there are many projects.
 * - Doesn't support creating new projects inline. Use the full Todo detail
 *   page or Projects view when you need to add a new project.
 */
export function ProjectChips({ value, projects, onChange }: ProjectChipsProps) {
  if (projects.length === 0) {
    return (
      <p className="text-on-surface-variant/60 text-xs italic">
        No projects yet — add one from the Projects page.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {projects.map((project) => {
        const selected = value === project
        return (
          <button
            key={project}
            type="button"
            onClick={() => onChange(selected ? null : project)}
            className={`px-3 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
              selected
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {project}
          </button>
        )
      })}
    </div>
  )
}
