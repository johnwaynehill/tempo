import { useEffect, useRef } from 'react'
import { useTodos } from '@/hooks/useTodos'
import { usePreferences } from '@/hooks/usePreferences'
import { useNotifications } from '@/hooks/useNotifications'

/**
 * Gentle reminder messages per PRD §7.4:
 * "Reminders use neutral language"
 */
const GENTLE_MESSAGES = [
  (title: string) => `Hey, you had this on your list: ${title}`,
  (title: string) => `Gentle nudge: ${title}`,
  (title: string) => `Whenever you're ready: ${title}`,
  (title: string) => `Still on your radar? ${title}`,
]

function pickMessage(title: string): string {
  const idx = Math.floor(Math.random() * GENTLE_MESSAGES.length)
  return GENTLE_MESSAGES[idx](title)
}

/**
 * Background scheduler that checks for due reminders every 30 seconds.
 * When a reminder fires, it:
 *   1. Sends a Web Notification with gentle language
 *   2. Clears the reminder_at field so it doesn't fire again
 *
 * Only active when notifications are enabled in preferences and granted by the OS.
 */
export function useReminderScheduler() {
  const { todos, updateTodo } = useTodos()
  const { preferences } = usePreferences()
  const { isGranted, sendNotification } = useNotifications()
  const firedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!preferences.notifications_enabled || !isGranted) return

    const check = () => {
      const now = new Date()

      for (const todo of todos) {
        // Skip if no reminder, already done, or already fired this session
        if (!todo.reminder_at) continue
        if (todo.status === 'done') continue
        if (firedRef.current.has(todo.id)) continue

        if (todo.reminder_at <= now) {
          // Fire notification
          const body = pickMessage(todo.title)
          sendNotification('Tempo', { body, tag: `reminder-${todo.id}` })

          // Mark as fired so we don't re-fire while clearing
          firedRef.current.add(todo.id)

          // Clear the reminder
          updateTodo(todo.id, { reminder_at: undefined })
        }
      }
    }

    // Check immediately, then every 30 seconds
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [todos, preferences.notifications_enabled, isGranted, sendNotification, updateTodo])
}
