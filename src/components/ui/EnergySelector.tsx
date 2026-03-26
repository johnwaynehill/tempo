import { ENERGY_LEVELS, ENERGY_LABELS, type EnergyLevel } from '@/types'

interface EnergySelectorProps {
  value?: EnergyLevel
  onChange: (level: EnergyLevel) => void
}

const ENERGY_COLORS: Record<EnergyLevel, string> = {
  low: 'bg-surface-container-high text-on-surface-variant',
  medium_low: 'bg-surface-container-high text-on-surface-variant',
  medium: 'bg-primary-container text-primary-dim',
  high: 'bg-primary text-on-primary',
}

const ENERGY_COLORS_ACTIVE: Record<EnergyLevel, string> = {
  low: 'bg-on-surface-variant text-surface',
  medium_low: 'bg-on-surface-variant text-surface',
  medium: 'bg-primary text-on-primary',
  high: 'bg-primary text-on-primary',
}

export function EnergySelector({ value, onChange }: EnergySelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-on-surface-variant font-medium mr-1">Energy</span>
      {ENERGY_LEVELS.map((level) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          className={`px-3 py-1 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
            value === level
              ? ENERGY_COLORS_ACTIVE[level]
              : ENERGY_COLORS[level]
          }`}
        >
          {ENERGY_LABELS[level]}
        </button>
      ))}
    </div>
  )
}
