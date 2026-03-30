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
  deleteField,
  Timestamp,
} from 'firebase/firestore'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { habitConverter } from '@/lib/converters'
import type { Habit } from '@/types'

// --- Types ---

export interface AddHabitInput {
  name: string
  description?: string
}

export interface HabitsContextValue {
  habits: Habit[]
  activeHabits: Habit[]
  loading: boolean
  addHabit: (input: AddHabitInput) => Promise<string>
  updateHabit: (id: string, updates: Partial<Pick<Habit, 'name' | 'description'>>) => Promise<void>
  toggleCompletion: (habitId: string, dateString: string) => Promise<void>
  archiveHabit: (id: string) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
}

// --- Context ---

const HabitsContext = createContext<HabitsContextValue | null>(null)

// --- Provider ---

export function HabitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)

  // Single shared onSnapshot listener
  useEffect(() => {
    if (!user) {
      setHabits([])
      setLoading(false)
      return
    }

    const ref = collection(db, 'users', user.uid, 'habits').withConverter(
      habitConverter,
    )

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const items = snapshot.docs.map((d) => d.data())
      setHabits(items)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  // Collection ref helper
  const habitsRef = () => {
    if (!user) throw new Error('Not authenticated')
    return collection(db, 'users', user.uid, 'habits')
  }

  // --- Mutations ---

  const addHabit = async (input: AddHabitInput) => {
    const id = uuid()
    const now = new Date()
    const habit: Habit = {
      id,
      name: input.name,
      description: input.description,
      frequency: 'daily',
      archived: false,
      completions: {},
      created_at: now,
      updated_at: now,
    }
    await setDoc(
      doc(habitsRef(), id).withConverter(habitConverter),
      habit,
    )
    return id
  }

  const updateHabit = async (id: string, updates: Partial<Pick<Habit, 'name' | 'description'>>) => {
    const data: Record<string, unknown> = {
      ...updates,
      updated_at: Timestamp.now(),
    }
    // Convert undefined to null for Firestore
    for (const key of Object.keys(data)) {
      if (data[key] === undefined) {
        data[key] = null
      }
    }
    await updateDoc(doc(habitsRef(), id), data)
  }

  const toggleCompletion = async (habitId: string, dateString: string) => {
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return

    const isCompleted = habit.completions[dateString]
    if (isCompleted) {
      // Remove the completion
      await updateDoc(doc(habitsRef(), habitId), {
        [`completions.${dateString}`]: deleteField(),
        updated_at: Timestamp.now(),
      })
    } else {
      // Add the completion
      await updateDoc(doc(habitsRef(), habitId), {
        [`completions.${dateString}`]: true,
        updated_at: Timestamp.now(),
      })
    }
  }

  const archiveHabit = async (id: string) => {
    await updateDoc(doc(habitsRef(), id), {
      archived: true,
      updated_at: Timestamp.now(),
    })
  }

  const deleteHabit = async (id: string) => {
    await deleteDoc(doc(habitsRef(), id))
  }

  // --- Filtered views (memoized) ---

  const activeHabits = useMemo(
    () => habits
      .filter((h) => !h.archived)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime()),
    [habits],
  )

  const value: HabitsContextValue = {
    habits,
    activeHabits,
    loading,
    addHabit,
    updateHabit,
    toggleCompletion,
    archiveHabit,
    deleteHabit,
  }

  return (
    <HabitsContext.Provider value={value}>
      {children}
    </HabitsContext.Provider>
  )
}

// --- Hook ---

export function useHabitsContext() {
  const ctx = useContext(HabitsContext)
  if (!ctx) throw new Error('useHabitsContext must be used within HabitsProvider')
  return ctx
}
