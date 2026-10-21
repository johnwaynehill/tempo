// Suggested metadata for a todo, from its title alone. The same prompt and validation as the
// web drawer's useSmartCapture (src/hooks/useSmartCapture.ts), run on the server so clients
// without an Anthropic client (iOS) can ask for it.

export interface SmartSuggestions {
  energyLevel?: 'low' | 'medium_low' | 'medium' | 'high'
  size?: 'small' | 'medium' | 'large'
  project?: string
  impact?: number
  estimatedMinutes?: number
  /** yyyy-MM-dd */
  dueDate?: string
}

export const SMART_CAPTURE_MODEL = 'claude-sonnet-5'
export const SMART_CAPTURE_MIN_CHARS = 5

export function smartCaptureSystemPrompt(today: string, projectNames: string[]): string {
  const projectList = projectNames.length > 0
    ? `Known projects: ${projectNames.join(', ')}`
    : 'No existing projects.'
  return `You are a task metadata classifier. Given a task title, suggest metadata. Return ONLY valid JSON with these optional fields:
- energy_level: one of "low", "medium_low", "medium", "high"
- size: one of "small", "medium", "large"
- project: pick from the known projects list ONLY, or omit if none fit
- impact: integer 1-5 (1=low, 5=critical)
- estimated_minutes: integer (common values: 5, 15, 25, 45, 60, 90)
- due_date: ISO date string if the task implies a deadline, omit otherwise. Today is ${today}.
${projectList}
Return JSON only, no explanation.`
}

const ENERGY = new Set(['low', 'medium_low', 'medium', 'high'])
const SIZES = new Set(['small', 'medium', 'large'])

/** Parses the model's reply, keeping only valid fields. Null when nothing usable came back. */
export function parseSmartSuggestions(text: string | undefined, projectNames: string[]): SmartSuggestions | null {
  if (!text) return null
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const valid: SmartSuggestions = {}
  if (typeof parsed.energy_level === 'string' && ENERGY.has(parsed.energy_level)) {
    valid.energyLevel = parsed.energy_level as SmartSuggestions['energyLevel']
  }
  if (typeof parsed.size === 'string' && SIZES.has(parsed.size)) {
    valid.size = parsed.size as SmartSuggestions['size']
  }
  if (typeof parsed.project === 'string' && projectNames.includes(parsed.project)) {
    valid.project = parsed.project
  }
  if (typeof parsed.impact === 'number' && parsed.impact >= 1 && parsed.impact <= 5) {
    valid.impact = Math.round(parsed.impact)
  }
  if (typeof parsed.estimated_minutes === 'number' && parsed.estimated_minutes > 0 && parsed.estimated_minutes <= 480) {
    valid.estimatedMinutes = Math.round(parsed.estimated_minutes)
  }
  if (typeof parsed.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due_date)) {
    valid.dueDate = parsed.due_date
  }
  return Object.keys(valid).length > 0 ? valid : null
}
