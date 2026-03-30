import {
  createContext,
  useContext,
  useEffect,
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
import { eventConverter } from '@/lib/converters'
import type { CalendarEvent } from '@/types'

// --- Types ---

export interface AddEventInput {
  title: string
  start_time: Date
  end_time: Date
  all_day?: boolean
  description?: string
  location?: string
  color?: CalendarEvent['color']
}

export interface EventsContextValue {
  events: CalendarEvent[]
  loading: boolean
  addEvent: (input: AddEventInput) => Promise<string>
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>
  removeEvent: (id: string) => Promise<void>
}

// --- Context ---

const EventsContext = createContext<EventsContextValue | null>(null)

// --- Provider ---

export function EventsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setEvents([])
      setLoading(false)
      return
    }

    const ref = collection(db, 'users', user.uid, 'events').withConverter(
      eventConverter,
    )

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const items = snapshot.docs.map((d) => d.data())
      setEvents(items)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  const eventsRef = () => {
    if (!user) throw new Error('Not authenticated')
    return collection(db, 'users', user.uid, 'events')
  }

  // --- Mutations ---

  const addEvent = async (input: AddEventInput) => {
    const id = uuid()
    const now = new Date()
    const event: CalendarEvent = {
      id,
      title: input.title,
      start_time: input.start_time,
      end_time: input.end_time,
      all_day: input.all_day ?? false,
      description: input.description,
      location: input.location,
      color: input.color,
      created_at: now,
      updated_at: now,
    }
    await setDoc(
      doc(eventsRef(), id).withConverter(eventConverter),
      event,
    )
    return id
  }

  const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    const data: Record<string, unknown> = { ...updates, updated_at: Timestamp.now() }

    for (const key of Object.keys(data)) {
      if (data[key] === undefined) {
        data[key] = null
      }
    }

    // Convert Date fields to Timestamps
    for (const key of ['start_time', 'end_time'] as const) {
      if (key in data) {
        const val = data[key]
        data[key] = val instanceof Date ? Timestamp.fromDate(val) : null
      }
    }

    await updateDoc(doc(eventsRef(), id), data)
  }

  const removeEvent = async (id: string) => {
    await deleteDoc(doc(eventsRef(), id))
  }

  const value: EventsContextValue = {
    events,
    loading,
    addEvent,
    updateEvent,
    removeEvent,
  }

  return (
    <EventsContext.Provider value={value}>
      {children}
    </EventsContext.Provider>
  )
}

// --- Hook ---

export function useEventsContext() {
  const ctx = useContext(EventsContext)
  if (!ctx) throw new Error('useEventsContext must be used within EventsProvider')
  return ctx
}
