import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
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
import { getNextOccurrence } from '@/lib/recurrence'
import type { Todo, TodoStatus, EnergyLevel, TodoSize, RecurrenceRule } from '@/types'

// --- Types ---

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

export interface TodosContextValue {
  todos: Todo[]
  inbox: Todo[]
  pinned: Todo[]
  backlog: Todo[]
  deferred: Todo[]
  done: Todo[]
  loading: boolean
  addTodo: (input: AddTodoInput) => Promise<string>
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>
  completeTodo: (id: string) => Promise<void>
  deferTodo: (id: string, until?: Date) => Promise<void>
  dismissFromToday: (id: string) => Promise<void>
  pinToToday: (id: string) => Promise<void>
  moveToBacklog: (id: string) => Promise<void>
  removeTodo: (id: string) => Promise<void>
  uncompleteTodo: (id: string) => Promise<void>
}

// --- Context ---

const TodosContext = createContext<TodosContextValue | null>(null)

// --- Provider ---

export function TodosProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)

  // Single shared onSnapshot listener
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
      const items = snapshot.docs.map((d) => d.data())
      setTodos(items)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  // Collection ref helper (stable across renders, depends only on user)
  const todosRef = () => {
    if (!user) throw new Error('Not authenticated')
    return collection(db, 'users', user.uid, 'todos')
  }

  // --- Mutations ---

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
      recurrence: input.recurrence,
      note_id: input.note_id,
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

    // Convert undefined values to null — Firestore ignores undefined
    for (const key of Object.keys(data)) {
      if (data[key] === undefined) {
        data[key] = null
      }
    }

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
    const todo = todos.find((t) => t.id === id)

    // Mark current instance as done
    await updateTodo(id, {
      status: 'done',
      completed_at: new Date(),
    })

    // If recurring, create the next occurrence
    if (todo?.recurrence) {
      const nextDue = getNextOccurrence(todo.recurrence, todo.due_date ?? new Date())
      const nextId = uuid()
      const now = new Date()
      const nextTodo: Todo = {
        id: nextId,
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
        created_at: now,
        updated_at: now,
      }
      await setDoc(
        doc(todosRef(), nextId).withConverter(todoConverter),
        nextTodo,
      )
    }
  }

  const deferTodo = async (id: string, until?: Date) => {
    await updateTodo(id, {
      status: 'deferred',
      defer_until: until ?? new Date(Date.now() + 86400000),
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

  const uncompleteTodo = async (id: string) => {
    await updateTodo(id, {
      status: 'backlog',
      completed_at: undefined,
    })
  }

  // --- Filtered views (memoized) ---

  const inbox = useMemo(() => todos.filter((t) => t.status === 'inbox'), [todos])
  const pinned = useMemo(() => todos.filter((t) => t.status === 'today_pinned'), [todos])
  const backlog = useMemo(() => todos.filter((t) => t.status === 'backlog'), [todos])
  const deferred = useMemo(
    () => todos.filter((t) => t.status === 'deferred' && t.defer_until && t.defer_until > new Date()),
    [todos],
  )
  const done = useMemo(() => todos.filter((t) => t.status === 'done'), [todos])

  const value: TodosContextValue = {
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

  return (
    <TodosContext.Provider value={value}>
      {children}
    </TodosContext.Provider>
  )
}

// --- Hook ---

export function useTodosContext() {
  const ctx = useContext(TodosContext)
  if (!ctx) throw new Error('useTodosContext must be used within TodosProvider')
  return ctx
}
