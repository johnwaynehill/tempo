import { useState, useCallback, useRef } from 'react'
import { anthropic, AI_ENABLED } from '@/lib/anthropic'

const TRIGGER_CHANCE = 0.3
const DISMISS_DELAY = 4000

/** Fallback messages if the API call fails or AI is disabled */
const FALLBACK_MESSAGES = [
  'Nice work — one less thing on your mind.',
  'Done. That feels good, doesn\'t it?',
  'Another one down. You\'re on a roll.',
  'Check. Momentum is building.',
  'That\'s progress. Keep going.',
]

export function useCompletionToast() {
  const [message, setMessage] = useState<string | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>()

  const dismiss = useCallback(() => {
    setMessage(null)
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
  }, [])

  const trigger = useCallback(async (todoTitle: string) => {
    // Roll the dice
    if (Math.random() > TRIGGER_CHANCE) return

    // Show a fallback immediately, then try to replace with AI
    const fallback = FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)]

    if (!AI_ENABLED) {
      setMessage(fallback)
      dismissTimer.current = setTimeout(dismiss, DISMISS_DELAY)
      return
    }

    // Optimistic: show fallback first so there's no delay
    setMessage(fallback)
    dismissTimer.current = setTimeout(dismiss, DISMISS_DELAY)

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-20250414',
        max_tokens: 60,
        system: 'You are Tempo, a calm and warm productivity companion for someone with ADHD. Generate a single short (under 12 words) celebration message for completing a task. Be warm, genuine, and encouraging — never cheesy, never use exclamation marks, never use emojis. Match the tone of: "Nice work — one less thing on your mind." or "Done. That feels good, doesn\'t it?"',
        messages: [
          { role: 'user', content: `I just completed: "${todoTitle}"` },
        ],
      })

      const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : null
      if (text) {
        // Clear existing timer and restart with AI message
        if (dismissTimer.current) clearTimeout(dismissTimer.current)
        setMessage(text)
        dismissTimer.current = setTimeout(dismiss, DISMISS_DELAY)
      }
    } catch {
      // Fallback already showing — just keep it
    }
  }, [dismiss])

  return { message, trigger, dismiss }
}
