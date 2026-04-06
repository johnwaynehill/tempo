import { useState, useEffect, useRef } from 'react'
import { anthropic, AI_ENABLED } from '@/lib/anthropic'
import type { EnergyLevel, TodoSize } from '@/types'

export interface SmartSuggestions {
  energy_level?: EnergyLevel
  size?: TodoSize
  project?: string
}

interface UseSmartCaptureResult {
  suggestions: SmartSuggestions | null
  loading: boolean
}

const DEBOUNCE_MS = 600
const MIN_CHARS = 5

export function useSmartCapture(
  title: string,
  enabled: boolean,
  projectNames: string[],
): UseSmartCaptureResult {
  const [suggestions, setSuggestions] = useState<SmartSuggestions | null>(null)
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef<Map<string, SmartSuggestions>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled || !AI_ENABLED || title.trim().length < MIN_CHARS) {
      setSuggestions(null)
      setLoading(false)
      return
    }

    const trimmed = title.trim()

    // Check cache
    if (cacheRef.current.has(trimmed)) {
      setSuggestions(cacheRef.current.get(trimmed)!)
      return
    }

    setLoading(true)

    const timer = setTimeout(async () => {
      // Abort previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const projectList = projectNames.length > 0
          ? `Known projects: ${projectNames.join(', ')}`
          : 'No existing projects.'

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-20250414',
          max_tokens: 80,
          system: `You are a task metadata classifier. Given a task title, suggest the most likely energy_level, size, and project. Return ONLY valid JSON with these optional fields:
- energy_level: one of "low", "medium_low", "medium", "high"
- size: one of "small", "medium", "large"
- project: pick from the known projects list ONLY, or omit if none fit.
${projectList}
Be concise. Return JSON only, no explanation.`,
          messages: [
            { role: 'user', content: trimmed },
          ],
        })

        if (controller.signal.aborted) return

        const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : null
        if (text) {
          const parsed = JSON.parse(text) as SmartSuggestions

          // Validate fields
          const valid: SmartSuggestions = {}
          if (['low', 'medium_low', 'medium', 'high'].includes(parsed.energy_level ?? '')) {
            valid.energy_level = parsed.energy_level
          }
          if (['small', 'medium', 'large'].includes(parsed.size ?? '')) {
            valid.size = parsed.size
          }
          if (parsed.project && projectNames.includes(parsed.project)) {
            valid.project = parsed.project
          }

          if (Object.keys(valid).length > 0) {
            cacheRef.current.set(trimmed, valid)
            setSuggestions(valid)
          } else {
            setSuggestions(null)
          }
        }
      } catch {
        // Silently fail — suggestions are a nice-to-have
        if (!controller.signal.aborted) {
          setSuggestions(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [title, enabled, projectNames])

  return { suggestions, loading }
}
