import { useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Note } from '@/types'

export function useNotes() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: rawNotes = [], isLoading: loading } = useQuery({
    queryKey: ['notes', user?.uid],
    queryFn: () => api.notes.list() as Promise<Note[]>,
    enabled: !!user,
    staleTime: 30_000,
  })

  // Sort by most recently updated
  const notes = useMemo(
    () => [...rawNotes].sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime()),
    [rawNotes],
  )

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notes'] })

  const addNote = useCallback(async (title: string, content: string = ''): Promise<string> => {
    const id = uuid()
    await api.notes.create({ id, title, content } as unknown as Record<string, unknown>)
    await invalidate()
    return id
  }, [])

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    await api.notes.update(id, updates as unknown as Record<string, unknown>)
    await invalidate()
  }, [])

  const removeNote = useCallback(async (id: string) => {
    await api.notes.delete(id)
    await invalidate()
  }, [])

  const getNoteById = useCallback((id: string) => notes.find((n) => n.id === id), [notes])

  return { notes, loading, addNote, updateNote, removeNote, getNoteById }
}
