import { useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Todo, TodoStatus, EnergyLevel, TodoSize, RecurrenceRule } from '@/types'

export interface AddTodoInput {
  title: string
  description?: string
  status?: TodoStatus
  project?: string
  impact?: number
  energy_level?: EnergyLevel
  size?: TodoSize
  due_date?: Date
  recurrence?: RecurrenceRule
  note_id?: string
}

export function useTodos() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: todos = [], isLoading: loading } = useQuery({
    queryKey: ['todos', user?.uid],
    queryFn: () => api.todos.list() as Promise<Todo[]>,
    enabled: !!user,
    staleTime: 30_000,
  })

  // --- Filtered views ---
  const inbox = useMemo(() => todos.filter((t) => t.status === 'inbox'), [todos])
  const pinned = useMemo(() => todos.filter((t) => t.status === 'today_pinned'), [todos])
  const backlog = useMemo(() => todos.filter((t) => t.status === 'backlog'), [todos])
  const deferred = useMemo(
    () => todos.filter((t) => t.status === 'deferred' && t.defer_until && t.defer_until > new Date()),
    [todos],
  )
  const done = useMemo(() => todos.filter((t) => t.status === 'done'), [todos])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['todos'] })

  // --- Mutations ---

  const addTodo = useCallback(async (input: AddTodoInput): Promise<string> => {
    const id = uuid()
    const todo = {
      id,
      title: input.title,
      status: input.status ?? 'inbox',
      project: input.project,
      impact: input.impact,
      energy_level: input.energy_level,
      size: input.size,
      due_date: input.due_date,
      recurrence: input.recurrence,
      note_id: input.note_id,
    }
    await api.todos.create(todo as unknown as Record<string, unknown>)
    await invalidate()
    return id
  }, [])

  const updateTodo = useCallback(async (id: string, updates: Partial<Todo>) => {
    // Convert undefined values to null for the API
    const data: Record<string, unknown> = { ...updates }
    for (const key of Object.keys(data)) {
      if (data[key] === undefined) data[key] = null
    }
    await api.todos.update(id, data)
    await invalidate()
  }, [])

  // Completion is server-side (POST /todos/:id/complete) so the next occurrence
  // of a recurring todo is created the same way for web, iOS and the MCP server.
  const completeTodo = useCallback(async (id: string, extra?: Partial<Todo>) => {
    const data: Record<string, unknown> = {}
    if (extra?.actual_minutes) data.actual_minutes = extra.actual_minutes
    await api.todos.complete(id, data)
    await invalidate()
  }, [])

  const deferTodo = useCallback(async (id: string, until?: Date) => {
    await updateTodo(id, {
      status: 'deferred',
      defer_until: until ?? new Date(Date.now() + 86400000),
    })
  }, [updateTodo])

  const dismissFromToday = useCallback(async (id: string) => {
    await updateTodo(id, { dismissed_from_today: new Date() })
  }, [updateTodo])

  const pinToToday = useCallback(async (id: string) => {
    await updateTodo(id, { status: 'today_pinned' })
  }, [updateTodo])

  const moveToBacklog = useCallback(async (id: string) => {
    await updateTodo(id, { status: 'backlog' })
  }, [updateTodo])

  const removeTodo = useCallback(async (id: string) => {
    await api.todos.delete(id)
    await invalidate()
  }, [])

  const uncompleteTodo = useCallback(async (id: string) => {
    await updateTodo(id, { status: 'backlog', completed_at: undefined })
  }, [updateTodo])

  return {
    todos,
    inbox,
    pinned,
    backlog,
    deferred,
    done,
    loading,
    addTodo,
    updateTodo,
    completeTodo,
    deferTodo,
    dismissFromToday,
    pinToToday,
    moveToBacklog,
    removeTodo,
    uncompleteTodo,
  }
}
