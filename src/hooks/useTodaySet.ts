import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { suggestTodayTodos } from '@/lib/scoring'
import type { Todo, TodaySet, EnergyLevel } from '@/types'

function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface UseTodaySetResult {
  /** The resolved todos for today (pinned + daily set, minus completed) */
  todayTodos: Todo[]
  /** Whether the set is still loading */
  loading: boolean
  /** Remove a todo from the daily set (dismiss without replacing) */
  dismissFromSet: (todoId: string) => void
}

export function useTodaySet(
  todos: Todo[],
  pinned: Todo[],
  currentEnergy?: EnergyLevel,
): UseTodaySetResult {
  const { user } = useAuth()
  const qc = useQueryClient()
  const generatingRef = useRef(false)
  const todayStr = todayDateString()

  const { data: todaySet, isLoading: loading } = useQuery({
    queryKey: ['today-set', user?.uid, todayStr],
    queryFn: async () => {
      const result = await api.todaySet.get(todayStr)
      return { date: result.date, todo_ids: result.todoIds ?? [] } as TodaySet
    },
    enabled: !!user,
    staleTime: 60_000,
  })

  // Generate the daily set if it's a new day
  useEffect(() => {
    if (!user || loading) return
    if (todaySet?.date === todayStr) return
    if (generatingRef.current) return

    generatingRef.current = true

    const pinnedIds = new Set(pinned.map((t) => t.id))
    const suggested = suggestTodayTodos(todos, currentEnergy, pinned.length)
    const todoIds = suggested
      .filter((t) => !pinnedIds.has(t.id))
      .map((t) => t.id)

    api.todaySet.update({ date: todayStr, todoIds }).then(() => {
      generatingRef.current = false
      qc.invalidateQueries({ queryKey: ['today-set'] })
    })
  }, [user, loading, todaySet, todayStr, todos, pinned, currentEnergy])

  // Resolve the daily set IDs to actual todos
  const todayTodos = useMemo(() => {
    if (!todaySet || todaySet.date !== todayStr) return [...pinned]

    const todoMap = new Map(todos.map((t) => [t.id, t]))
    const pinnedIds = new Set(pinned.map((t) => t.id))

    const setTodos = todaySet.todo_ids
      .filter((id) => !pinnedIds.has(id))
      .map((id) => todoMap.get(id))
      .filter((t): t is Todo => t !== undefined && t.status !== 'done')

    return [...pinned, ...setTodos]
  }, [todaySet, todayStr, todos, pinned])

  const dismissFromSet = useCallback((todoId: string) => {
    if (!user || !todaySet) return
    const updatedIds = todaySet.todo_ids.filter((id) => id !== todoId)
    api.todaySet.update({ date: todaySet.date, todoIds: updatedIds }).then(() => {
      qc.invalidateQueries({ queryKey: ['today-set'] })
    })
  }, [user, todaySet])

  return { todayTodos, loading, dismissFromSet }
}
