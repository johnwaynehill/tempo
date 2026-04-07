import { ENERGY_LABELS, type EnergyLevel, type TodoSize } from '@/types'
import { formatMinutes } from '@/hooks/useTimer'
import type { SmartSuggestions } from '@/hooks/useSmartCapture'

const SIZE_LABELS: Record<TodoSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

interface SmartCaptureSuggestionsProps {
  suggestions: SmartSuggestions
  /** Fields the user has already set manually — skip those suggestions */
  setFields: {
    energy_level?: boolean
    size?: boolean
    project?: boolean
    impact?: boolean
    estimated_minutes?: boolean
    due_date?: boolean
  }
  onAcceptAll: (suggestions: SmartSuggestions) => void
}

export function SmartCaptureSuggestions({
  suggestions,
  setFields,
  onAcceptAll,
}: SmartCaptureSuggestionsProps) {
  // Build the applicable suggestions (skip fields already set)
  const applicable: SmartSuggestions = {}
  const parts: string[] = []

  if (suggestions.energy_level && !setFields.energy_level) {
    applicable.energy_level = suggestions.energy_level
    parts.push(ENERGY_LABELS[suggestions.energy_level as EnergyLevel] + ' energy')
  }

  if (suggestions.size && !setFields.size) {
    applicable.size = suggestions.size
    parts.push(SIZE_LABELS[suggestions.size as TodoSize].toLowerCase())
  }

  if (suggestions.impact && !setFields.impact) {
    applicable.impact = suggestions.impact
    parts.push(`impact ${suggestions.impact}`)
  }

  if (suggestions.estimated_minutes && !setFields.estimated_minutes) {
    applicable.estimated_minutes = suggestions.estimated_minutes
    parts.push(formatMinutes(suggestions.estimated_minutes))
  }

  if (suggestions.project && !setFields.project) {
    applicable.project = suggestions.project
    parts.push(suggestions.project)
  }

  if (suggestions.due_date && !setFields.due_date) {
    applicable.due_date = suggestions.due_date
    const d = new Date(suggestions.due_date + 'T00:00:00')
    parts.push('due ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
  }

  if (parts.length === 0) return null

  return (
    <div className="flex items-center gap-2 animate-gentle-appear">
      <p className="text-xs text-on-surface-variant/60 flex-1 min-w-0">
        <svg className="w-3 h-3 text-primary/50 inline-block mr-1 -mt-0.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M7 2C7 5.5 9 7.5 13 8C9 8.5 7 10.5 7 14C7 10.5 5 8.5 1 8C5 7.5 7 5.5 7 2Z" />
        </svg>
        {parts.join(' · ')}
      </p>
      <button
        onClick={() => onAcceptAll(applicable)}
        className="px-2.5 py-1 rounded-lg bg-primary/8 text-primary text-xs font-medium hover:bg-primary/15 transition-colors cursor-pointer shrink-0"
      >
        Apply
      </button>
    </div>
  )
}
