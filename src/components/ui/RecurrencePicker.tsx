import { useState, useEffect } from 'react'
import type { RecurrenceRule, RecurrenceFrequency } from '@/types'
import { describeRecurrence } from '@/lib/recurrence'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface RecurrencePickerProps {
  value: RecurrenceRule | undefined
  onChange: (rule: RecurrenceRule | undefined) => void
  onClose: () => void
}

/**
 * Set or edit a todo's repeat schedule.
 *
 * Rendered as a bottom-sheet on mobile and a centered modal on desktop
 * (`items-end md:items-center` switches the chrome). The previous
 * implementation used `position: absolute` to anchor to a trigger; when the
 * picker moved into the overflow menu on the TodoDetailPage it lost any
 * positioning context and rendered off-screen. The sheet/modal owns the
 * viewport so it doesn't depend on where the trigger lives.
 */
export function RecurrencePicker({ value, onChange, onClose }: RecurrencePickerProps) {
  const [frequency, setFrequency] = useState<RecurrenceFrequency | null>(value?.frequency ?? null)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(value?.days_of_week ?? [])
  const [dayOfMonth, setDayOfMonth] = useState<number>(value?.day_of_month ?? new Date().getDate())

  // Close on Escape. Capture phase + `stopImmediatePropagation` so a parent
  // page's Esc handler doesn't also fire (e.g. TodoDetailPage's Esc-to-go-back).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

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
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />
      <div
        className="relative w-full max-h-[70vh] md:w-[420px] md:max-h-[60vh] bg-surface-container-lowest rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-1.5 rounded-full bg-outline-variant/40 hover:bg-outline-variant/60 transition-colors cursor-pointer"
          />
        </div>

        {/* Header (desktop only) */}
        <div className="hidden md:flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-on-surface font-display text-base font-semibold">Repeat</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        {/* Mobile header */}
        <h2 className="md:hidden text-on-surface font-display text-base font-semibold px-5 pt-2 pb-1">Repeat</h2>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-5 pb-4 pt-2 space-y-3">
          {/* Frequency row */}
          <div className="flex gap-1.5">
            {(['daily', 'weekly', 'monthly'] as RecurrenceFrequency[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleFrequencyChange(f)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
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
            <div>
              <p className="text-xs text-on-surface-variant mb-1.5 font-medium">Days of week</p>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`flex-1 h-11 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      daysOfWeek.includes(i)
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly: day input */}
          {frequency === 'monthly' && (
            <div>
              <p className="text-xs text-on-surface-variant mb-1.5 font-medium">Day of month</p>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => handleDayOfMonthChange(parseInt(e.target.value) || 1)}
                className="w-20 bg-surface-container rounded-lg px-3 py-2.5 text-on-surface text-base text-center outline-none min-h-[44px]"
              />
            </div>
          )}

          {/* Current description */}
          {frequency && (
            <p className="text-on-surface-variant text-xs pt-1">
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
              type="button"
              onClick={handleRemove}
              className="w-full text-sm text-error/80 hover:text-error py-2.5 transition-colors cursor-pointer text-left"
            >
              Remove repeat schedule
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
