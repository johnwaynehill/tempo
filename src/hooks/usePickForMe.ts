import { useState, useCallback, useRef } from 'react'
import { anthropic, AI_ENABLED } from '@/lib/anthropic'
import type { Todo, EnergyLevel } from '@/types'

const DISMISS_DELAY = 10_000

interface PickResult {
  todo: Todo
  reason: string
}

interface UsePickForMeResult {
  pick: PickResult | null
  loading: boolean
  pickForMe: () => void
  dismiss: () => void
}

function serializeTodoShort(t: Todo): string {
  const parts = [`id:"${t.id}"`, `"${t.title}"`]
  if (t.energy_level) parts.push(`energy:${t.energy_level}`)
  if (t.size) parts.push(`size:${t.size}`)
  if (t.impact) parts.push(`impact:${t.impact}`)
  if (t.estimated_minutes) parts.push(`est:${t.estimated_minutes}min`)
  if (t.due_date) parts.push(`due:${t.due_date.toISOString().split('T')[0]}`)
  return parts.join(' | ')
}

export function usePickForMe(todayTodos: Todo[], currentEnergy?: EnergyLevel): UsePickForMeResult {
  const [pick, setPick] = useState<PickResult | null>(null)
  const [loading, setLoading] = useState(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const dismiss = useCallback(() => {
    setPick(null)
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
  }, [])

  const pickForMe = useCallback(async () => {
    if (todayTodos.length === 0) return
    setLoading(true)
    dismiss()

    // Random fallback
    const randomTodo = todayTodos[Math.floor(Math.random() * todayTodos.length)]
    const fallbackResult: PickResult = {
      todo: randomTodo,
      reason: 'This one feels right for now. Just start.',
    }

    if (!AI_ENABLED || todayTodos.length === 1) {
      setPick(todayTodos.length === 1
        ? { todo: todayTodos[0], reason: 'Only one task — no decision needed.' }
        : fallbackResult
      )
      setLoading(false)
      dismissTimer.current = setTimeout(dismiss, DISMISS_DELAY)
      return
    }

    try {
      const hour = new Date().getHours()
      const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
      const todoList = todayTodos.map((t) => serializeTodoShort(t)).join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-20250414',
        max_tokens: 120,
        system: `You are Tempo, an ADHD productivity assistant. The user is paralyzed by choice and needs you to pick ONE task to start right now. Consider: energy match, time of day (${timeOfDay}), task urgency, and size. Return ONLY valid JSON: {"todo_id":"...","reason":"..."}. The reason must be under 20 words, warm, and direct. No quotes around the JSON.`,
        messages: [
          {
            role: 'user',
            content: `My energy: ${currentEnergy ?? 'not set'}\nMy tasks:\n${todoList}\n\nPick one for me.`,
          },
        ],
      })

      const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : null
      if (text) {
        const parsed = JSON.parse(text) as { todo_id: string; reason: string }
        const matched = todayTodos.find((t) => t.id === parsed.todo_id)
        if (matched) {
          setPick({ todo: matched, reason: parsed.reason })
          setLoading(false)
          dismissTimer.current = setTimeout(dismiss, DISMISS_DELAY)
          return
        }
      }
    } catch {
      // Fall through to fallback
    }

    setPick(fallbackResult)
    setLoading(false)
    dismissTimer.current = setTimeout(dismiss, DISMISS_DELAY)
  }, [todayTodos, currentEnergy, dismiss])

  return { pick, loading, pickForMe, dismiss }
}
