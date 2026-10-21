import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import type { EnergyLevel, TodoSize } from '@/types'

export interface SmartSuggestions {
  energy_level?: EnergyLevel
  size?: TodoSize
  project?: string
  impact?: number
  estimated_minutes?: number
  due_date?: string // ISO date string e.g. "2026-04-10"
}

interface UseSmartCaptureResult {
  suggestions: SmartSuggestions | null
  loading: boolean
}

const DEBOUNCE_MS = 600
const MIN_CHARS = 5

// Errors that won't change by asking again this session: the daily AI cap, a key without
// the `ai` scope, or a server with no Anthropic key. After one, stop asking until reload.
const UNAVAILABLE = /ai_budget_exceeded|Insufficient scope|AI is not configured/
let unavailable = false

/**
 * Suggested metadata for a new todo's title, from `POST /api/smart-capture` (which holds the
 * prompt, the model and the validation, shared with iOS, and counts toward the daily AI cap).
 */
export function useSmartCapture(title: string, enabled: boolean): UseSmartCaptureResult {
  const [suggestions, setSuggestions] = useState<SmartSuggestions | null>(null)
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef<Map<string, SmartSuggestions | null>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const trimmed = title.trim()
    if (!enabled || unavailable || trimmed.length < MIN_CHARS) {
      setSuggestions(null)
      setLoading(false)
      return
    }

    if (cacheRef.current.has(trimmed)) {
      setSuggestions(cacheRef.current.get(trimmed)!)
      return
    }

    setLoading(true)

    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const result = await api.smartCapture.suggest(trimmed, controller.signal)
        if (controller.signal.aborted) return
        const valid = (result as SmartSuggestions | null) ?? null
        cacheRef.current.set(trimmed, valid)
        setSuggestions(valid)
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof Error && UNAVAILABLE.test(err.message)) unavailable = true
        setSuggestions(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [title, enabled])

  return { suggestions, loading }
}
