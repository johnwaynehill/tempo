import { useState, useEffect, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { ChatMessage } from '@/hooks/useAIChat'

// --- Types ---

export interface Conversation {
  id: string
  mode: 'today' | 'breakdown'
  todoId?: string
  style?: string
  title: string
  displayMessages: ChatMessage[]
  apiMessages: string // JSON-serialized Anthropic messages
  created_at: Date
  updated_at: Date
}

interface SerializedConversation {
  id: string
  mode: string
  todoId?: string
  style?: string
  title: string
  displayMessages: string // JSON
  apiMessages: string // JSON
  created_at: Timestamp
  updated_at: Timestamp
}

// --- Hook ---
// NOTE: Chat history remains on Firestore for now.
// It will move to Postgres in a future phase when the conversations API
// is extended with streaming support.

export function useChatHistory() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const convsRef = useCallback(() => {
    if (!user) throw new Error('Not authenticated')
    return collection(db, 'users', user.uid, 'conversations')
  }, [user])

  // Listen to recent conversations
  useEffect(() => {
    if (!user) {
      setConversations([])
      setLoading(false)
      return
    }

    const ref = collection(db, 'users', user.uid, 'conversations')
    const q = query(ref, orderBy('updated_at', 'desc'), limit(20))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const data = d.data() as SerializedConversation
        return deserialize(data)
      })
      setConversations(items)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  // Save (create or update) a conversation
  const saveConversation = useCallback(
    async (conv: Conversation) => {
      if (!user) return
      const serialized = serialize(conv)
      await setDoc(doc(convsRef(), conv.id), serialized)
    },
    [user, convsRef],
  )

  // Delete a conversation
  const deleteConversation = useCallback(
    async (id: string) => {
      if (!user) return
      await deleteDoc(doc(convsRef(), id))
    },
    [user, convsRef],
  )

  // Find the most recent conversation matching mode (optionally from today only)
  const findRecent = useCallback(
    (mode: string, todayOnly = false): Conversation | undefined => {
      const match = conversations.find((c) => {
        if (c.mode !== mode) return false
        if (todayOnly) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          return c.updated_at >= today
        }
        return true
      })
      return match
    },
    [conversations],
  )

  return {
    conversations,
    loading,
    saveConversation,
    deleteConversation,
    findRecent,
    createId: () => uuid(),
  }
}

// --- Serialization ---

function serialize(conv: Conversation): SerializedConversation {
  return {
    id: conv.id,
    mode: conv.mode,
    ...(conv.todoId && { todoId: conv.todoId }),
    ...(conv.style && { style: conv.style }),
    title: conv.title,
    displayMessages: JSON.stringify(conv.displayMessages),
    apiMessages: conv.apiMessages,
    created_at: Timestamp.fromDate(conv.created_at),
    updated_at: Timestamp.fromDate(conv.updated_at),
  }
}

function deserialize(data: SerializedConversation): Conversation {
  let displayMessages: ChatMessage[] = []
  try {
    const parsed = JSON.parse(data.displayMessages)
    displayMessages = parsed.map((m: Record<string, unknown>) => ({
      ...m,
      timestamp: new Date(m.timestamp as string),
    }))
  } catch {
    // ignore parse errors
  }

  return {
    id: data.id,
    mode: data.mode as 'today' | 'breakdown',
    todoId: data.todoId,
    style: data.style,
    title: data.title,
    displayMessages,
    apiMessages: data.apiMessages || '[]',
    created_at: data.created_at?.toDate?.() ?? new Date(),
    updated_at: data.updated_at?.toDate?.() ?? new Date(),
  }
}
