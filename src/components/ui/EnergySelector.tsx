import { ENERGY_LEVELS, ENERGY_LABELS, type EnergyLevel } from '@/types'

interface EnergySelectorProps {
  value?: EnergyLevel
  onChange: (level: EnergyLevel) => void
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
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-high text-on-surface-variant'
          }`}
        >
          {ENERGY_LABELS[level]}
        </button>
      ))}
    </div>
  )
}
