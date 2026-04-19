import { useState, useRef } from 'react'
import { useTodos, type AddTodoInput } from '@/hooks/useTodos'
import type { TodoStatus } from '@/types'

/**
 * Hook for creating a new todo and immediately opening the detail drawer.
 * Handles cleanup of empty-titled todos when the drawer is closed.
 */
export function useNewTodo(defaultStatus: TodoStatus = 'inbox', defaults?: Partial<Omit<AddTodoInput, 'title' | 'status'>>) {
  const { todos, addTodo, removeTodo } = useTodos()
  const [newTodoId, setNewTodoId] = useState<string | null>(null)

  // Keep refs so callbacks always have fresh data
  const todosRef = useRef(todos)
  todosRef.current = todos
  const defaultsRef = useRef(defaults)
  defaultsRef.current = defaults

  const createTodo = async () => {
    const clean: Record<string, unknown> = {}
    if (defaultsRef.current) {
      for (const [k, v] of Object.entries(defaultsRef.current)) {
        if (v !== undefined) clean[k] = v
      }
    }
    const id = await addTodo({ title: '', status: defaultStatus, ...clean })
    setNewTodoId(id)
  }

  const closeNewTodo = () => {
    const todoId = newTodoId
    setNewTodoId(null)
    if (todoId) {
      // Delay cleanup to allow the drawer's title blur-save to propagate
      setTimeout(() => {
        const todo = todosRef.current.find((t) => t.id === todoId)
        if (todo && !todo.title.trim()) {
          removeTodo(todoId)
        }
      }, 300)
    }
  }

  const newTodo = newTodoId ? todos.find((t) => t.id === newTodoId) : undefined

  return { newTodo, createTodo, closeNewTodo }
}
