import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { useAIChat, type ChatMessage, type ToolCallDisplay } from '@/hooks/useAIChat'
import { useChatHistory, type Conversation } from '@/hooks/useChatHistory'
import { useTodos } from '@/hooks/useTodos'
import { useNotes } from '@/hooks/useNotes'
import { useHabits } from '@/hooks/useHabits'
import { useEvents } from '@/hooks/useEvents'
import { usePreferences } from '@/hooks/usePreferences'
import { useTodaySet } from '@/hooks/useTodaySet'
import {
  buildBreakdownSystemPrompt,
  buildBreakdownFirstMessage,
  buildTodayCurationSystemPrompt,
  type BreakdownStyle,
} from '@/lib/ai-system-prompts'
import type { ToolContext } from '@/lib/ai-tool-executor'
import type Anthropic from '@anthropic-ai/sdk'

export function AIChatPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const mode = searchParams.get('mode') as 'breakdown' | 'today' | null
  const todoId = searchParams.get('todoId')
  const style = searchParams.get('style') as BreakdownStyle | null
  const initialQuery = searchParams.get('q')

  const {
    todos,
    pinned,
    addTodo,
    updateTodo,
    completeTodo,
    pinToToday,
    deferTodo,
    moveToBacklog,
    dismissFromToday,
    loading: todosLoading,
  } = useTodos()
  const { notes, addNote, updateNote: updateNoteCtx } = useNotes()
  const { habits } = useHabits()
  const { events } = useEvents()
  const { preferences } = usePreferences()
  const { todayTodos } = useTodaySet(todos, pinned, preferences.current_energy)

  // Chat history persistence
  const {
    findRecent,
    saveConversation,
    createId,
    loading: historyLoading,
  } = useChatHistory()

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialSentRef = useRef(false)
  const conversationIdRef = useRef<string | null>(null)

  // Build the tool context
  const toolContext: ToolContext = useMemo(
    () => ({
      todos,
      notes,
      addTodo,
      updateTodo,
      completeTodo,
      pinToToday,
      deferTodo,
      moveToBacklog,
      dismissFromToday,
      addNote,
      updateNote: updateNoteCtx,
    }),
    [todos, notes, addTodo, updateTodo, completeTodo, pinToToday, deferTodo, moveToBacklog, dismissFromToday, addNote, updateNoteCtx],
  )

  // Find the target todo for breakdown mode
  const targetTodo = todoId ? todos.find((t) => t.id === todoId) : undefined

  // Build system prompt based on mode
  const systemPrompt = useMemo(() => {
    if (mode === 'breakdown' && targetTodo && style) {
      return buildBreakdownSystemPrompt({
        todo: targetTodo,
        style,
        currentEnergy: preferences.current_energy,
        todayCount: todayTodos.length,
      })
    }
    return buildTodayCurationSystemPrompt({
      todos,
      notes,
      habits,
      events,
      currentEnergy: preferences.current_energy,
      todayTodoIds: todayTodos.map((t) => t.id),
    })
  }, [mode, targetTodo, style, todos, notes, habits, events, preferences.current_energy, todayTodos])

  // Try to restore a recent conversation for "today" mode
  const restoredConversation = useMemo(() => {
    if (historyLoading) return undefined
    if (mode === 'today' && !initialQuery) {
      return findRecent('today', true) // today's conversations only
    }
    return undefined
  }, [mode, initialQuery, historyLoading, findRecent])

  const initialMessages = restoredConversation?.displayMessages
  const initialApiMessages = useMemo(() => {
    if (!restoredConversation?.apiMessages) return undefined
    try {
      return JSON.parse(restoredConversation.apiMessages) as Anthropic.MessageParam[]
    } catch {
      return undefined
    }
  }, [restoredConversation])

  // Set conversation ID from restored or generate new
  if (restoredConversation && !conversationIdRef.current) {
    conversationIdRef.current = restoredConversation.id
  }

  // Persist after each message exchange
  const handleMessagesChange = useCallback(
    (displayMessages: ChatMessage[], apiMessages: Anthropic.MessageParam[]) => {
      if (!conversationIdRef.current) {
        conversationIdRef.current = createId()
      }

      const title =
        displayMessages.find((m) => m.role === 'user')?.content.slice(0, 80) ?? 'Chat'

      const conv: Conversation = {
        id: conversationIdRef.current,
        mode: (mode as 'today' | 'breakdown') ?? 'today',
        ...(todoId && { todoId }),
        ...(style && { style }),
        title,
        displayMessages,
        apiMessages: JSON.stringify(apiMessages),
        created_at: restoredConversation?.created_at ?? new Date(),
        updated_at: new Date(),
      }

      saveConversation(conv)
    },
    [mode, todoId, style, restoredConversation, createId, saveConversation],
  )

  const { messages, isStreaming, error, sendMessage } = useAIChat({
    systemPrompt,
    toolContext,
    initialMessages,
    initialApiMessages,
    onMessagesChange: handleMessagesChange,
  })

  // Auto-send first message for breakdown mode
  useEffect(() => {
    if (initialSentRef.current) return
    if (todosLoading || historyLoading) return

    // Don't auto-send if we restored a conversation
    if (restoredConversation) return

    if (mode === 'breakdown' && targetTodo && style) {
      initialSentRef.current = true
      const firstMsg = buildBreakdownFirstMessage(targetTodo, style)
      sendMessage(firstMsg)
    } else if (mode === 'today' && initialQuery) {
      initialSentRef.current = true
      sendMessage(decodeURIComponent(initialQuery))
    }
  }, [mode, targetTodo, style, initialQuery, todosLoading, historyLoading, restoredConversation])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || isStreaming) return
    setInputValue('')
    sendMessage(text)
  }

  const handleNewChat = () => {
    conversationIdRef.current = null
    initialSentRef.current = false
    // Navigate to refresh state — strip query params to start fresh
    navigate('/chat?mode=today', { replace: true })
    window.location.reload()
  }

  // Mode header
  const modeTitle = mode === 'breakdown'
    ? `Breaking down: ${targetTodo?.title ?? 'Task'}`
    : 'Plan Your Day'

  const modeSubtitle = mode === 'breakdown'
    ? style === 'micro-steps' ? 'Micro-steps mode'
      : style === 'gamify' ? 'Gamify mode'
        : 'Transition protocol'
    : 'Ask Claude to help organize your day'

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-3rem)] -my-8 md:-my-12">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-semibold text-on-surface truncate">
            {modeTitle}
          </h1>
          <p className="text-on-surface-variant text-xs">{modeSubtitle}</p>
        </div>

        {/* New chat button (today mode only, when there are messages) */}
        {mode === 'today' && messages.length > 0 && (
          <button
            onClick={handleNewChat}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            title="Start new conversation"
          >
            New chat
          </button>
        )}

        {/* AI sparkle icon */}
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-primary" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0l1.5 5.5L16 8l-6.5 2.5L8 16l-1.5-5.5L0 8l6.5-2.5z" />
          </svg>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-4">
        {messages.length === 0 && !isStreaming && mode === 'today' && (
          <div className="text-center py-16 animate-gentle-appear">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0l1.5 5.5L16 8l-6.5 2.5L8 16l-1.5-5.5L0 8l6.5-2.5z" />
              </svg>
            </div>
            <p className="text-on-surface font-display font-semibold text-base mb-1">
              What do you need?
            </p>
            <p className="text-on-surface-variant text-sm max-w-xs mx-auto">
              Ask me to plan your day, reorganize your list, or help you get started on something.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && messages.length > 0 && messages[messages.length - 1]?.content === '' && (
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-on-surface-variant text-xs">Claude is thinking...</span>
          </div>
        )}

        {error && (
          <div className="mx-4 px-4 py-3 rounded-xl bg-error/10 text-error text-sm">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 pt-3 pb-2"
      >
        <div className="flex items-center gap-2 bg-surface-container rounded-2xl px-4 py-2.5 border border-outline-variant/20 focus-within:border-primary/40 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isStreaming ? 'Claude is responding...' : 'Type a message...'}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-on-surface text-sm outline-none placeholder:text-on-surface-variant/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !inputValue.trim()}
            className="p-1.5 rounded-lg bg-primary text-on-primary disabled:opacity-30 transition-opacity cursor-pointer"
            aria-label="Send"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2L2 8.5l4.5 1.5M14 2l-3 12-3.5-8.5M14 2L6.5 10" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}

// --- Message Bubble ---

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] ${
          isUser
            ? 'bg-primary/10 text-on-surface rounded-2xl rounded-br-lg px-4 py-3'
            : 'text-on-surface'
        }`}
      >
        {/* Text content */}
        {message.content && (
          <div
            className={`text-sm leading-relaxed whitespace-pre-wrap ${
              isUser ? '' : 'prose-sm'
            }`}
            dangerouslySetInnerHTML={{
              __html: isUser ? escapeHtml(message.content) : formatMarkdown(message.content),
            }}
          />
        )}

        {/* Tool call indicators */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 ${message.content ? 'mt-3' : ''}`}>
            {message.toolCalls.map((tc, i) => (
              <ToolCallChip key={i} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Tool Call Chip ---

function ToolCallChip({ toolCall }: { toolCall: ToolCallDisplay }) {
  const displayText = toolCall.result

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
        toolCall.success
          ? 'bg-primary/8 text-primary'
          : 'bg-error/10 text-error'
      }`}
    >
      {toolCall.success ? (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2.5 6L5 8.5L9.5 3.5" />
        </svg>
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      )}
      {displayText}
    </span>
  )
}

// --- Helpers ---

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatMarkdown(text: string): string {
  return escapeHtml(text)
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-surface-container text-xs font-mono">$1</code>')
    // Line breaks
    .replace(/\n/g, '<br />')
}
