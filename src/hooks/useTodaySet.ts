import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Todo, TodaySet } from '@/types'

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
): UseTodaySetResult {
  const { user } = useAuth()
  const qc = useQueryClient()
  const generatingRef = useRef(false)
  const todayStr = todayDateString()

  const { data: todaySet, isLoading: loading } = useQuery({
    queryKey: ['today-set', user?.uid, todayStr],
    queryFn: async () => {
      const result = await api.todaySet.get(todayStr)
      return { date: result.date, todo_ids: result.todoIds ?? [], exists: result.exists !== false } as TodaySet
    },
    enabled: !!user,
    staleTime: 60_000,
  })

  // Generate the daily set if it's a new day
  useEffect(() => {
    if (!user || loading) return
    // The API answers a missing day with an empty default row carrying today's
    // date, so "date matches" never meant "already generated" — check `exists`.
    if (todaySet?.date === todayStr && todaySet.exists) return
    if (generatingRef.current) return

    generatingRef.current = true

    // The server owns the scoring (api/src/lib/autoplan.ts); every client asks it.
    api.todaySet.generate(todayStr).then(() => {
      generatingRef.current = false
      qc.invalidateQueries({ queryKey: ['today-set'] })
    })
  }, [user, loading, todaySet, todayStr])

  // Resolve the daily set IDs to actual todos
  const todayTodos = useMemo(() => {
    if (!todaySet || todaySet.date !== todayStr) return [...pinned]

    const todoMap = new Map(todos.map((t) => [t.id, t]))
    const pinnedIds = new Set(pinned.map((t) => t.id))

    // Filter out todos whose status has moved them out of Today since the
    // today_set row was written (e.g. user deferred from the detail page).
    // `today_set` is a morning snapshot — it doesn't get rewritten on every
    // status change — so the render layer is the defensive filter.
    //
    // We keep `today_pinned` (explicitly pinned) and `backlog` (still active,
    // surfaced as a suggestion) but drop anything done, deferred, or moved
    // back to inbox.
    const setTodos = todaySet.todo_ids
      .filter((id) => !pinnedIds.has(id))
      .map((id) => todoMap.get(id))
      .filter((t): t is Todo => {
        if (!t) return false
        return t.status === 'today_pinned' || t.status === 'backlog'
      })

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
