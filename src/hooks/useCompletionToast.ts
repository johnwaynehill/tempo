import { useState, useCallback, useRef } from 'react'
import { anthropic, AI_ENABLED, AI_MODEL } from '@/lib/anthropic'

const TRIGGER_CHANCE = import.meta.env.DEV ? 1.0 : 0.3
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
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const shown = useRef(false)

  const dismiss = useCallback(() => {
    setMessage(null)
    shown.current = false
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
  }, [])

  const showMessage = useCallback((text: string) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    shown.current = true
    setMessage(text)
    dismissTimer.current = setTimeout(dismiss, DISMISS_DELAY)
  }, [dismiss])

  const trigger = useCallback(async (todoTitle: string) => {
    // Roll the dice
    if (Math.random() > TRIGGER_CHANCE) return

    const fallback = FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)]

    if (!AI_ENABLED) {
      showMessage(fallback)
      return
    }

    // Give AI 800ms to respond before showing fallback
    const fallbackTimer = setTimeout(() => {
      if (!shown.current) showMessage(fallback)
    }, 800)

    try {
      const response = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 60,
        system: 'You are Tempo, a calm and warm productivity companion for someone with ADHD. Generate a single short (under 12 words) celebration message for completing a task. Be warm, genuine, and encouraging — never cheesy, never use exclamation marks, never use emojis. Match the tone of: "Nice work — one less thing on your mind." or "Done. That feels good, doesn\'t it?"',
        messages: [
          { role: 'user', content: `I just completed: "${todoTitle}"` },
        ],
      })

      clearTimeout(fallbackTimer)
      // Only show AI response if fallback hasn't already been displayed
      if (!shown.current) {
        const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : null
        showMessage(text || fallback)
      }
    } catch {
      clearTimeout(fallbackTimer)
      if (!shown.current) showMessage(fallback)
    }
  }, [showMessage])

  return { message, trigger, dismiss }
}
