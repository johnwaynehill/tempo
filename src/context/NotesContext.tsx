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
import { noteConverter } from '@/lib/converters'
import type { Note } from '@/types'

// --- Types ---

export interface NotesContextValue {
  notes: Note[]
  loading: boolean
  addNote: (title: string, content?: string) => Promise<string>
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>
  removeNote: (id: string) => Promise<void>
  getNoteById: (id: string) => Note | undefined
}

// --- Context ---

const NotesContext = createContext<NotesContextValue | null>(null)

// --- Provider ---

export function NotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  // Single shared onSnapshot listener
  useEffect(() => {
    if (!user) {
      setNotes([])
      setLoading(false)
      return
    }

    const ref = collection(db, 'users', user.uid, 'notes').withConverter(
      noteConverter,
    )

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const items = snapshot.docs.map((d) => d.data())
      // Sort by most recently updated
      items.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
      setNotes(items)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  // Collection ref helper
  const notesRef = () => {
    if (!user) throw new Error('Not authenticated')
    return collection(db, 'users', user.uid, 'notes')
  }

  // --- Mutations ---

  const addNote = async (title: string, content: string = '') => {
    const id = uuid()
    const now = new Date()
    const note: Note = {
      id,
      title,
      content,
      created_at: now,
      updated_at: now,
    }
    await setDoc(
      doc(notesRef(), id).withConverter(noteConverter),
      note,
    )
    return id
  }

  const updateNote = async (id: string, updates: Partial<Note>) => {
    await updateDoc(doc(notesRef(), id), {
      ...updates,
      updated_at: Timestamp.now(),
    })
  }

  const removeNote = async (id: string) => {
    await deleteDoc(doc(notesRef(), id))
  }

  const getNoteById = (id: string) => notes.find((n) => n.id === id)

  const value: NotesContextValue = {
    notes,
    loading,
    addNote,
    updateNote,
    removeNote,
    getNoteById,
  }

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  )
}

// --- Hook ---

export function useNotesContext() {
  const ctx = useContext(NotesContext)
  if (!ctx) throw new Error('useNotesContext must be used within NotesProvider')
  return ctx
}
