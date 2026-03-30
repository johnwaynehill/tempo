import { useState, useEffect } from 'react'
import type { RecurrenceRule, RecurrenceFrequency } from '@/types'
import { describeRecurrence } from '@/lib/recurrence'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface RecurrencePickerProps {
  value: RecurrenceRule | undefined
  onChange: (rule: RecurrenceRule | undefined) => void
  onClose: () => void
}

export function RecurrencePicker({ value, onChange, onClose }: RecurrencePickerProps) {
  const [frequency, setFrequency] = useState<RecurrenceFrequency | null>(value?.frequency ?? null)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(value?.days_of_week ?? [])
  const [dayOfMonth, setDayOfMonth] = useState<number>(value?.day_of_month ?? new Date().getDate())

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleFrequencyChange = (f: RecurrenceFrequency) => {
    if (frequency === f) {
      // Toggle off
      setFrequency(null)
      onChange(undefined)
      return
    }
    setFrequency(f)

    // Apply immediately with defaults
    if (f === 'daily') {
      onChange({ frequency: 'daily' })
    } else if (f === 'weekly') {
      const today = new Date().getDay()
      const days = daysOfWeek.length > 0 ? daysOfWeek : [today]
      setDaysOfWeek(days)
      onChange({ frequency: 'weekly', days_of_week: days })
    } else if (f === 'monthly') {
      onChange({ frequency: 'monthly', day_of_month: dayOfMonth })
    }
  }

  const toggleDay = (day: number) => {
    const updated = daysOfWeek.includes(day)
      ? daysOfWeek.filter((d) => d !== day)
      : [...daysOfWeek, day]

    // Don't allow removing all days
    if (updated.length === 0) return

    setDaysOfWeek(updated)
    onChange({ frequency: 'weekly', days_of_week: updated })
  }

  const handleDayOfMonthChange = (day: number) => {
    const clamped = Math.max(1, Math.min(31, day))
    setDayOfMonth(clamped)
    onChange({ frequency: 'monthly', day_of_month: clamped })
  }

  const handleRemove = () => {
    onChange(undefined)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 bottom-full mb-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 p-4 min-w-[260px]">
        {/* Frequency row */}
        <div className="flex gap-1.5 mb-3">
          {(['daily', 'weekly', 'monthly'] as RecurrenceFrequency[]).map((f) => (
            <button
              key={f}
              onClick={() => handleFrequencyChange(f)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                frequency === f
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Weekly: day picker */}
        {frequency === 'weekly' && (
          <div className="flex gap-1 mb-3">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  daysOfWeek.includes(i)
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Monthly: day input */}
        {frequency === 'monthly' && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-on-surface-variant text-xs">Day of month:</span>
            <input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => handleDayOfMonthChange(parseInt(e.target.value) || 1)}
              className="w-16 bg-surface-container rounded-lg px-3 py-1.5 text-on-surface text-sm text-center outline-none"
            />
          </div>
        )}

        {/* Current description */}
        {frequency && (
          <p className="text-on-surface-variant text-xs mb-3">
            {describeRecurrence(
              frequency === 'daily' ? { frequency: 'daily' }
              : frequency === 'weekly' ? { frequency: 'weekly', days_of_week: daysOfWeek }
              : { frequency: 'monthly', day_of_month: dayOfMonth }
            )}
          </p>
        )}

        {/* Remove button */}
        {value && (
          <button
            onClick={handleRemove}
            className="w-full text-left text-xs text-error/70 hover:text-error py-1.5 transition-colors cursor-pointer"
          >
            Remove recurrence
          </button>
        )}
      </div>
    </>
  )
}
