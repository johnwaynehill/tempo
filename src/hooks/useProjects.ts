import { useMemo } from 'react'
import { useTodos } from '@/hooks/useTodos'
import { useNotes } from '@/hooks/useNotes'

interface UseProjectsResult {
  /** Sorted unique project names (excludes undefined/empty) */
  projects: string[]
  /** Map of project name to active (non-done) todo count */
  projectCounts: Record<string, number>
  /** Map of project name to note count */
  noteCounts: Record<string, number>
}

export function useProjects(): UseProjectsResult {
  const { todos } = useTodos()
  const { notes } = useNotes()

  return useMemo(() => {
    const counts: Record<string, number> = {}
    const nCounts: Record<string, number> = {}

    for (const t of todos) {
      if (t.project) {
        if (t.status !== 'done') {
          counts[t.project] = (counts[t.project] ?? 0) + 1
        } else {
          counts[t.project] = counts[t.project] ?? 0
        }
      }
    }

    for (const n of notes) {
      if (n.project) {
        nCounts[n.project] = (nCounts[n.project] ?? 0) + 1
        // Ensure project appears in counts even if no todos
        counts[n.project] = counts[n.project] ?? 0
      }
    }

    const projects = Object.keys(counts).sort((a, b) => a.localeCompare(b))

    return { projects, projectCounts: counts, noteCounts: nCounts }
  }, [todos, notes])
}
