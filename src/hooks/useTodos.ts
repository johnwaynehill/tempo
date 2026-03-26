import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { todoConverter } from '@/lib/converters'
import type { Todo, TodoStatus, EnergyLevel, TodoSize } from '@/types'

interface AddTodoInput {
  title: string
  status?: TodoStatus
  project?: string
  impact?: number
  energy_level?: EnergyLevel
  size?: TodoSize
  due_date?: Date
}

export function useTodos() {
  const { user } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTodos([])
      setLoading(false)
      return
    }

    const ref = collection(db, 'users', user.uid, 'todos').withConverter(
      todoConverter,
    )

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const items = snapshot.docs.map((doc) => doc.data())
      setTodos(items)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  const todosRef = () => {
    if (!user) throw new Error('Not authenticated')
    return collection(db, 'users', user.uid, 'todos')
  }

  const addTodo = async (input: AddTodoInput) => {
    const id = uuid()
    const now = new Date()
    const todo: Todo = {
      id,
      title: input.title,
      status: input.status ?? 'inbox',
      project: input.project,
      impact: input.impact,
      energy_level: input.energy_level,
      size: input.size,
      due_date: input.due_date,
      created_at: now,
      updated_at: now,
    }
    await setDoc(
      doc(todosRef(), id).withConverter(todoConverter),
      todo,
    )
    return id
  }

  const updateTodo = async (id: string, updates: Partial<Todo>) => {
    const data: Record<string, unknown> = { ...updates, updated_at: Timestamp.now() }

    // Convert Date fields to Timestamps for Firestore
    for (const key of ['due_date', 'defer_until', 'reminder_at', 'dismissed_from_today', 'completed_at'] as const) {
      if (key in data) {
        const val = data[key]
        data[key] = val instanceof Date ? Timestamp.fromDate(val) : null
      }
    }

    await updateDoc(doc(todosRef(), id), data)
  }

  const completeTodo = async (id: string) => {
    await updateTodo(id, {
      status: 'done',
      completed_at: new Date(),
    })
  }

  const deferTodo = async (id: string, until?: Date) => {
    await updateTodo(id, {
      status: 'deferred',
      defer_until: until ?? new Date(Date.now() + 86400000), // default: tomorrow
    })
  }

  const dismissFromToday = async (id: string) => {
    await updateTodo(id, {
      dismissed_from_today: new Date(),
    })
  }

  const pinToToday = async (id: string) => {
    await updateTodo(id, {
      status: 'today_pinned',
    })
  }

  const moveToBacklog = async (id: string) => {
    await updateTodo(id, {
      status: 'backlog',
    })
  }

  const removeTodo = async (id: string) => {
    await deleteDoc(doc(todosRef(), id))
  }

  // Filtered views
  const inbox = todos.filter((t) => t.status === 'inbox')
  const pinned = todos.filter((t) => t.status === 'today_pinned')
  const backlog = todos.filter((t) => t.status === 'backlog')
  const deferred = todos.filter(
    (t) => t.status === 'deferred' && t.defer_until && t.defer_until > new Date(),
  )
  const done = todos.filter((t) => t.status === 'done')

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
  }
}
