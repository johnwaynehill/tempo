import { useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { getNextOccurrence } from '@/lib/recurrence'
import type { Todo, TodoStatus, EnergyLevel, TodoSize, RecurrenceRule } from '@/types'

export interface AddTodoInput {
  title: string
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
    const now = new Date()
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
      created_at: now,
      updated_at: now,
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

  const completeTodo = useCallback(async (id: string) => {
    const todo = todos.find((t) => t.id === id)
    await updateTodo(id, { status: 'done', completed_at: new Date() })

    // If recurring, create next occurrence
    if (todo?.recurrence) {
      const nextDue = getNextOccurrence(todo.recurrence, todo.due_date ?? new Date())
      await api.todos.create({
        title: todo.title,
        status: 'backlog',
        project: todo.project,
        size: todo.size,
        impact: todo.impact,
        energy_level: todo.energy_level,
        due_date: nextDue,
        recurrence: todo.recurrence,
        recurrence_parent_id: todo.recurrence_parent_id ?? todo.id,
        note_id: todo.note_id,
        supports: todo.supports,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as Record<string, unknown>)
      await invalidate()
    }
  }, [todos, updateTodo])

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
