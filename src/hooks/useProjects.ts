import { useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useTodos } from '@/hooks/useTodos'
import { useNotes } from '@/hooks/useNotes'
import type { Project } from '@/types'

interface UseProjectsResult {
  /** Sorted project names */
  projects: string[]
  /** Full project objects from DB */
  projectList: Project[]
  /** Active (non-done) todo count per project name */
  projectCounts: Record<string, number>
  /** Note count per project name */
  noteCounts: Record<string, number>
  loading: boolean
  renameProject: (id: string, newName: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export function useProjects(): UseProjectsResult {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { todos } = useTodos()
  const { notes } = useNotes()

  const { data: projectList = [], isLoading: loading } = useQuery({
    queryKey: ['projects', user?.uid],
    queryFn: () => api.projects.list() as Promise<Project[]>,
    enabled: !!user,
    staleTime: 30_000,
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['projects'] })
  }, [qc])

  const renameProject = useCallback(async (id: string, newName: string) => {
    await api.projects.update(id, { name: newName })
    invalidate()
    qc.invalidateQueries({ queryKey: ['todos'] })
  }, [invalidate, qc])

  const deleteProject = useCallback(async (id: string) => {
    await api.projects.delete(id)
    invalidate()
    qc.invalidateQueries({ queryKey: ['todos'] })
    qc.invalidateQueries({ queryKey: ['notes'] })
  }, [invalidate, qc])

  const derived = useMemo(() => {
    const counts: Record<string, number> = {}
    const nCounts: Record<string, number> = {}

    for (const p of projectList) {
      counts[p.name] = 0
      nCounts[p.name] = 0
    }

    for (const t of todos) {
      if (t.project && t.status !== 'done' && counts[t.project] !== undefined) {
        counts[t.project]++
      }
    }

    for (const n of notes) {
      for (const projName of (n.projects ?? [])) {
        if (nCounts[projName] !== undefined) {
          nCounts[projName]++
        }
      }
    }

    const projects = projectList.map(p => p.name).sort((a, b) => a.localeCompare(b))
    return { projects, projectCounts: counts, noteCounts: nCounts }
  }, [projectList, todos, notes])

  return { ...derived, projectList, loading, renameProject, deleteProject }
}
