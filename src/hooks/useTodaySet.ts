import { useEffect, useState, useMemo, useRef } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { todaySetConverter } from '@/lib/converters'
import { suggestTodayTodos } from '@/lib/scoring'
import type { Todo, TodaySet, EnergyLevel } from '@/types'

function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface UseTodaySetResult {
  /** The resolved todos for today (pinned + daily set, minus completed) */
  todayTodos: Todo[]
  /** Whether the set is still loading from Firestore */
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
  const [todaySet, setTodaySet] = useState<TodaySet | null>(null)
  const [loading, setLoading] = useState(true)
  const generatingRef = useRef(false)

  const todayStr = todayDateString()

  // Subscribe to the today_set document
  useEffect(() => {
    if (!user) {
      setTodaySet(null)
      setLoading(false)
      return
    }

    const ref = doc(db, 'users', user.uid, 'settings', 'today_set').withConverter(todaySetConverter)

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        setTodaySet(snapshot.data())
      } else {
        setTodaySet(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  // Generate the daily set if it's a new day (or first time)
  useEffect(() => {
    if (!user || loading) return
    if (todaySet?.date === todayStr) return // Already have today's set
    if (generatingRef.current) return // Prevent double-generation

    generatingRef.current = true

    const pinnedIds = new Set(pinned.map((t) => t.id))
    const suggested = suggestTodayTodos(todos, currentEnergy, pinned.length)
    const todoIds = suggested
      .filter((t) => !pinnedIds.has(t.id))
      .map((t) => t.id)

    const ref = doc(db, 'users', user.uid, 'settings', 'today_set')
    setDoc(ref, { date: todayStr, todo_ids: todoIds }).then(() => {
      generatingRef.current = false
    })
  }, [user, loading, todaySet, todayStr, todos, pinned, currentEnergy])

  // Resolve the daily set IDs to actual todos, filtering out completed/deleted
  const todayTodos = useMemo(() => {
    if (!todaySet || todaySet.date !== todayStr) return [...pinned]

    const todoMap = new Map(todos.map((t) => [t.id, t]))
    const pinnedIds = new Set(pinned.map((t) => t.id))

    const setTodos = todaySet.todo_ids
      .filter((id) => !pinnedIds.has(id)) // Don't duplicate pinned items
      .map((id) => todoMap.get(id))
      .filter((t): t is Todo => t !== undefined && t.status !== 'done')

    return [...pinned, ...setTodos]
  }, [todaySet, todayStr, todos, pinned])

  // Dismiss a todo from the daily set
  const dismissFromSet = (todoId: string) => {
    if (!user || !todaySet) return

    const updatedIds = todaySet.todo_ids.filter((id) => id !== todoId)
    const ref = doc(db, 'users', user.uid, 'settings', 'today_set')
    setDoc(ref, { date: todaySet.date, todo_ids: updatedIds })
  }

  return { todayTodos, loading, dismissFromSet }
}
