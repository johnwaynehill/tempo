import { useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Habit } from '@/types'

export interface AddHabitInput {
  name: string
  description?: string
}

export function useHabits() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: habits = [], isLoading: loading } = useQuery({
    queryKey: ['habits', user?.uid],
    queryFn: () => api.habits.list() as Promise<Habit[]>,
    enabled: !!user,
    staleTime: 30_000,
  })

  const activeHabits = useMemo(
    () => habits
      .filter((h) => !h.archived)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime()),
    [habits],
  )

  const invalidate = () => qc.invalidateQueries({ queryKey: ['habits'] })

  const addHabit = useCallback(async (input: AddHabitInput): Promise<string> => {
    const id = uuid()
    await api.habits.create({
      id, name: input.name, description: input.description,
      frequency: 'daily', archived: false, completions: {},
    } as unknown as Record<string, unknown>)
    await invalidate()
    return id
  }, [])

  const updateHabit = useCallback(async (id: string, updates: Partial<Pick<Habit, 'name' | 'description'>>) => {
    await api.habits.update(id, updates as Record<string, unknown>)
    await invalidate()
  }, [])

  const toggleCompletion = useCallback(async (habitId: string, dateString: string) => {
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return
    const isCompleted = habit.completions[dateString]
    await api.habits.toggleCompletion(habitId, dateString, !isCompleted)
    await invalidate()
  }, [habits])

  const archiveHabit = useCallback(async (id: string) => {
    await api.habits.update(id, { archived: true })
    await invalidate()
  }, [])

  const deleteHabit = useCallback(async (id: string) => {
    await api.habits.delete(id)
    await invalidate()
  }, [])

  return { habits, activeHabits, loading, addHabit, updateHabit, toggleCompletion, archiveHabit, deleteHabit }
}
