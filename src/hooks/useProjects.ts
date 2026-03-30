import { useMemo } from 'react'
import { useTodos } from '@/hooks/useTodos'

interface UseProjectsResult {
  /** Sorted unique project names (excludes undefined/empty) */
  projects: string[]
  /** Map of project name to active (non-done) todo count */
  projectCounts: Record<string, number>
}

export function useProjects(): UseProjectsResult {
  const { todos } = useTodos()

  return useMemo(() => {
    const counts: Record<string, number> = {}

    for (const t of todos) {
      if (t.project) {
        if (t.status !== 'done') {
          counts[t.project] = (counts[t.project] ?? 0) + 1
        } else {
          // Ensure project appears even if all todos are done
          counts[t.project] = counts[t.project] ?? 0
        }
      }
    }

    const projects = Object.keys(counts).sort((a, b) => a.localeCompare(b))

    return { projects, projectCounts: counts }
  }, [todos])
}
