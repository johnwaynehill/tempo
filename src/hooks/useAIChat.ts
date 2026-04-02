import { useState, useCallback, useRef } from 'react'
import { anthropic, AI_MODEL } from '@/lib/anthropic'
import { AI_TOOLS } from '@/lib/ai-tools'
import { executeToolCall, type ToolContext } from '@/lib/ai-tool-executor'
import type Anthropic from '@anthropic-ai/sdk'

// --- Types ---

export interface ToolCallDisplay {
  toolName: string
  input: Record<string, unknown>
  result: string
  success: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCallDisplay[]
  timestamp: Date
}

interface UseAIChatOptions {
  systemPrompt: string
  toolContext: ToolContext
  initialMessages?: ChatMessage[]
  initialApiMessages?: Anthropic.MessageParam[]
  onMessagesChange?: (displayMessages: ChatMessage[], apiMessages: Anthropic.MessageParam[]) => void
}

export interface UseAIChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  getApiMessages: () => Anthropic.MessageParam[]
}

// --- Hook ---

const MAX_TOOL_LOOPS = 10

export function useAIChat({
  systemPrompt,
  toolContext,
  initialMessages,
  initialApiMessages,
  onMessagesChange,
}: UseAIChatOptions): UseAIChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? [])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep the full Anthropic-format messages for API calls
  const apiMessagesRef = useRef<Anthropic.MessageParam[]>(initialApiMessages ?? [])
  const onMessagesChangeRef = useRef(onMessagesChange)
  onMessagesChangeRef.current = onMessagesChange

  const getApiMessages = useCallback(() => apiMessagesRef.current, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return
      setError(null)
      setIsStreaming(true)

      // Add user message to display
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      }
      const updatedMessages = [...messages, userMsg]
      setMessages(updatedMessages)

      // Add to API messages
      apiMessagesRef.current = [
        ...apiMessagesRef.current,
        { role: 'user' as const, content: text },
      ]

      try {
        await streamWithToolLoop(
          apiMessagesRef.current,
          systemPrompt,
          toolContext,
          setMessages,
          onMessagesChangeRef,
          apiMessagesRef,
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        console.error('[AI Chat]', err)
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, messages, systemPrompt, toolContext],
  )

  return { messages, isStreaming, error, sendMessage, getApiMessages }
}

// --- Streaming with tool-use loop ---

async function streamWithToolLoop(
  apiMessages: Anthropic.MessageParam[],
  systemPrompt: string,
  toolContext: ToolContext,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  onMessagesChangeRef: React.MutableRefObject<
    ((displayMessages: ChatMessage[], apiMessages: Anthropic.MessageParam[]) => void) | undefined
  >,
  apiMessagesRef: React.MutableRefObject<Anthropic.MessageParam[]>,
) {
  let loopCount = 0

  while (loopCount < MAX_TOOL_LOOPS) {
    loopCount++

    // Create a placeholder assistant message for streaming
    const assistantMsgId = crypto.randomUUID()
    const toolCalls: ToolCallDisplay[] = []
    let textContent = ''

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        toolCalls: [],
        timestamp: new Date(),
      },
    ])

    // Make the streaming API call
    const stream = anthropic.messages.stream({
      model: AI_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: apiMessages,
      tools: AI_TOOLS,
    })

    // Collect the full response content blocks for the API message
    const responseContentBlocks: Anthropic.ContentBlock[] = []
    let stopReason: string | null = null

    // Process stream events
    stream.on('text', (text) => {
      textContent += text
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: textContent } : m,
        ),
      )
    })

    // Wait for the stream to complete
    const finalMessage = await stream.finalMessage()
    stopReason = finalMessage.stop_reason
    responseContentBlocks.push(...finalMessage.content)

    // Extract text from response for display
    const fullText = finalMessage.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // Update the message with final text
    textContent = fullText

    // Check for tool use blocks
    const toolUseBlocks = finalMessage.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )

    if (toolUseBlocks.length > 0) {
      // Execute each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of toolUseBlocks) {
        const result = await executeToolCall(
          block.name,
          block.input as Record<string, unknown>,
          toolContext,
        )

        toolCalls.push({
          toolName: block.name,
          input: block.input as Record<string, unknown>,
          result: result.message,
          success: result.success,
        })

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result.message,
          is_error: !result.success,
        })
      }

      // Update display message with tool calls
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: textContent, toolCalls: [...toolCalls] }
            : m,
        ),
      )

      // Add the assistant response and tool results to API messages
      apiMessages.push({
        role: 'assistant' as const,
        content: responseContentBlocks,
      })
      apiMessages.push({
        role: 'user' as const,
        content: toolResults,
      })

      // If stop reason is 'tool_use', continue the loop so Claude can respond
      if (stopReason === 'tool_use') {
        continue
      }
    }

    // Update final message
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === assistantMsgId
          ? { ...m, content: textContent, toolCalls: [...toolCalls] }
          : m,
      )
      // Notify persistence layer
      onMessagesChangeRef.current?.(updated, apiMessagesRef.current)
      return updated
    })

    // Add final assistant message to API messages
    if (toolUseBlocks.length === 0) {
      apiMessages.push({
        role: 'assistant' as const,
        content: responseContentBlocks,
      })
    }

    // Done — exit the loop
    break
  }
}
