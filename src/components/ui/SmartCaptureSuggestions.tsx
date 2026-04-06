import { ENERGY_LABELS, type EnergyLevel, type TodoSize } from '@/types'
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
  }
  onAccept: (field: string, value: unknown) => void
}

export function SmartCaptureSuggestions({
  suggestions,
  setFields,
  onAccept,
}: SmartCaptureSuggestionsProps) {
  const chips: { label: string; field: string; value: unknown }[] = []

  if (suggestions.energy_level && !setFields.energy_level) {
    chips.push({
      label: `Energy: ${ENERGY_LABELS[suggestions.energy_level as EnergyLevel]}`,
      field: 'energy_level',
      value: suggestions.energy_level,
    })
  }

  if (suggestions.size && !setFields.size) {
    chips.push({
      label: `Size: ${SIZE_LABELS[suggestions.size as TodoSize]}`,
      field: 'size',
      value: suggestions.size,
    })
  }

  if (suggestions.project && !setFields.project) {
    chips.push({
      label: suggestions.project,
      field: 'project',
      value: suggestions.project,
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap animate-gentle-appear">
      <svg className="w-3 h-3 text-primary/40 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path d="M7 2C7 5.5 9 7.5 13 8C9 8.5 7 10.5 7 14C7 10.5 5 8.5 1 8C5 7.5 7 5.5 7 2Z" />
      </svg>
      {chips.map((chip) => (
        <button
          key={chip.field}
          onClick={() => onAccept(chip.field, chip.value)}
          className="px-2.5 py-1 rounded-lg bg-primary/8 text-primary text-xs font-medium hover:bg-primary/15 transition-colors cursor-pointer"
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
