import { useState, useEffect } from 'react'
import { DateField } from '@/components/ui/DateField'

interface ReminderPickerProps {
  currentReminder?: Date
  onSet: (date: Date) => void
  onClear: () => void
  onClose: () => void
}

/** Quick-pick options for setting a reminder. */
const quickOptions = [
  {
    label: 'In 1 hour',
    getDate: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    label: 'In 3 hours',
    getDate: () => new Date(Date.now() + 3 * 60 * 60 * 1000),
  },
  {
    label: 'Tomorrow 9am',
    getDate: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
      return d
    },
  },
  {
    label: 'Monday 9am',
    getDate: () => {
      const d = new Date()
      const day = d.getDay()
      const daysUntilMonday = day === 0 ? 1 : 8 - day
      d.setDate(d.getDate() + daysUntilMonday)
      d.setHours(9, 0, 0, 0)
      return d
    },
  },
]

/**
 * Set or edit a todo's reminder.
 *
 * Rendered as a bottom-sheet on mobile and a centered modal on desktop
 * (`items-end md:items-center` switches chrome). Like RecurrencePicker, the
 * previous popover implementation lost its positioning context when invoked
 * from the overflow menu on the TodoDetailPage. The sheet/modal pattern
 * doesn't depend on trigger location.
 */
export function ReminderPicker({ currentReminder, onSet, onClear, onClose }: ReminderPickerProps) {
  const [customDate, setCustomDate] = useState<Date | null>(null)
  const [customTime, setCustomTime] = useState('09:00')

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const handleCustom = () => {
    if (!customDate) return
    const [hours, minutes] = customTime.split(':').map(Number)
    const date = new Date(customDate)
    date.setHours(hours, minutes, 0, 0)
    if (date > new Date()) {
      onSet(date)
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />
      <div
        className="relative w-full max-h-[80vh] md:w-[420px] md:max-h-[70vh] bg-surface-container-lowest rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col"
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
          <h2 className="text-on-surface font-display text-base font-semibold">Reminder</h2>
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
        <h2 className="md:hidden text-on-surface font-display text-base font-semibold px-5 pt-2 pb-1">Reminder</h2>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-5 pb-4 pt-2 space-y-3">
          {/* Current reminder display */}
          {currentReminder && (
            <div className="bg-surface-container rounded-lg px-3 py-2.5">
              <p className="text-xs text-on-surface-variant">Currently set for</p>
              <p className="text-sm text-on-surface font-medium">
                {currentReminder.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                at{' '}
                {currentReminder.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              <button
                type="button"
                onClick={() => { onClear(); onClose() }}
                className="text-xs text-error/80 hover:text-error mt-1.5 cursor-pointer"
              >
                Remove reminder
              </button>
            </div>
          )}

          {/* Quick options */}
          <div>
            <p className="text-xs text-on-surface-variant mb-1.5 font-medium">Quick</p>
            <div className="grid grid-cols-2 gap-1.5">
              {quickOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => { onSet(opt.getDate()); onClose() }}
                  className="text-left px-3 py-2.5 text-sm text-on-surface bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer min-h-[44px]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date/time */}
          <div>
            <p className="text-xs text-on-surface-variant mb-1.5 font-medium">Custom</p>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <DateField
                  value={customDate}
                  onChange={setCustomDate}
                  placeholder="Pick a date"
                />
              </div>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                aria-label="Time"
                className="w-28 min-w-0 bg-surface-container rounded-lg px-3 py-2.5 text-on-surface text-sm outline-none min-h-[44px]"
              />
            </div>
            <button
              type="button"
              onClick={handleCustom}
              disabled={!customDate}
              className="w-full text-sm px-3 py-2.5 mt-2 rounded-lg bg-primary text-on-primary font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px]"
            >
              Set reminder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
