import { useState, useEffect, useRef, useMemo } from 'react'
import { anthropic, AI_ENABLED, AI_MODEL } from '@/lib/anthropic'
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

export function useSmartCapture(
  title: string,
  enabled: boolean,
  projectNames: string[],
): UseSmartCaptureResult {
  const [suggestions, setSuggestions] = useState<SmartSuggestions | null>(null)
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef<Map<string, SmartSuggestions>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  // Stabilize projectNames to avoid re-triggering the effect on every render
  const stableProjectNames = useMemo(() => projectNames, [projectNames.join(',')])

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
    console.log('[SmartCapture] Debouncing for title:', trimmed)

    const timer = setTimeout(async () => {
      console.log('[SmartCapture] Firing API call for:', trimmed)
      // Abort previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const projectList = stableProjectNames.length > 0
          ? `Known projects: ${stableProjectNames.join(', ')}`
          : 'No existing projects.'

        const today = new Date().toISOString().split('T')[0]

        const response = await anthropic.messages.create({
          model: AI_MODEL,
          max_tokens: 120,
          system: `You are a task metadata classifier. Given a task title, suggest metadata. Return ONLY valid JSON with these optional fields:
- energy_level: one of "low", "medium_low", "medium", "high"
- size: one of "small", "medium", "large"
- project: pick from the known projects list ONLY, or omit if none fit
- impact: integer 1-5 (1=low, 5=critical)
- estimated_minutes: integer (common values: 5, 15, 25, 45, 60, 90)
- due_date: ISO date string if the task implies a deadline, omit otherwise. Today is ${today}.
${projectList}
Return JSON only, no explanation.`,
          messages: [
            { role: 'user', content: trimmed },
          ],
        })

        if (controller.signal.aborted) return

        let text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : null
        // Strip markdown code fences if present
        if (text) {
          text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,  '').trim()
          const parsed = JSON.parse(text) as SmartSuggestions

          // Validate fields
          const valid: SmartSuggestions = {}
          if (['low', 'medium_low', 'medium', 'high'].includes(parsed.energy_level ?? '')) {
            valid.energy_level = parsed.energy_level
          }
          if (['small', 'medium', 'large'].includes(parsed.size ?? '')) {
            valid.size = parsed.size
          }
          if (parsed.project && stableProjectNames.includes(parsed.project)) {
            valid.project = parsed.project
          }
          if (typeof parsed.impact === 'number' && parsed.impact >= 1 && parsed.impact <= 5) {
            valid.impact = Math.round(parsed.impact)
          }
          if (typeof parsed.estimated_minutes === 'number' && parsed.estimated_minutes > 0 && parsed.estimated_minutes <= 480) {
            valid.estimated_minutes = parsed.estimated_minutes
          }
          if (parsed.due_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due_date)) {
            valid.due_date = parsed.due_date
          }

          if (Object.keys(valid).length > 0) {
            cacheRef.current.set(trimmed, valid)
            setSuggestions(valid)
          } else {
            setSuggestions(null)
          }
        }
      } catch (err) {
        console.warn('[SmartCapture] AI call failed:', err)
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
  }, [title, enabled, stableProjectNames])

  return { suggestions, loading }
}
