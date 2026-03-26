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
import { noteConverter } from '@/lib/converters'
import type { Note } from '@/types'

export function useNotes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

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
      const items = snapshot.docs.map((doc) => doc.data())
      // Sort by most recently updated
      items.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
      setNotes(items)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  const notesRef = () => {
    if (!user) throw new Error('Not authenticated')
    return collection(db, 'users', user.uid, 'notes')
  }

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

  return {
    notes,
    loading,
    addNote,
    updateNote,
    removeNote,
    getNoteById,
  }
}
