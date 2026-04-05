import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
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

// --- Hook ---

export function useChatHistory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: conversations = [], isLoading: loading } = useQuery({
    queryKey: ['conversations', user?.uid],
    queryFn: () => api.conversations.list().then(rows =>
      rows.map(r => fromApiConversation(r as Record<string, unknown>))
    ),
    enabled: !!user,
  })

  // Save (create or update) a conversation
  const saveConversation = useCallback(
    async (conv: Conversation) => {
      if (!user) return
      await api.conversations.save(conv.id, {
        mode: conv.mode,
        todoId: conv.todoId,
        style: conv.style,
        title: conv.title,
        displayMessages: conv.displayMessages,
        apiMessages: typeof conv.apiMessages === 'string'
          ? JSON.parse(conv.apiMessages)
          : conv.apiMessages,
      })
      queryClient.invalidateQueries({ queryKey: ['conversations', user.uid] })
    },
    [user, queryClient],
  )

  // Delete a conversation
  const deleteConversation = useCallback(
    async (id: string) => {
      if (!user) return
      await api.conversations.delete(id)
      queryClient.invalidateQueries({ queryKey: ['conversations', user.uid] })
    },
    [user, queryClient],
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

// --- API response mapping ---

function fromApiConversation(r: Record<string, unknown>): Conversation {
  const displayMessages = Array.isArray(r.display_messages)
    ? (r.display_messages as Record<string, unknown>[]).map(m => ({
        ...m,
        timestamp: m.timestamp ? new Date(m.timestamp as string) : new Date(),
      })) as ChatMessage[]
    : []

  return {
    id: r.id as string,
    mode: r.mode as 'today' | 'breakdown',
    todoId: r.todo_id as string | undefined,
    style: r.style as string | undefined,
    title: r.title as string,
    displayMessages,
    apiMessages: JSON.stringify(r.api_messages ?? []),
    created_at: r.created_at instanceof Date ? r.created_at : new Date(r.created_at as string),
    updated_at: r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at as string),
  }
}
