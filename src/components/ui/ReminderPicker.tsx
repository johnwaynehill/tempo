import { useState } from 'react'

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

export function ReminderPicker({ currentReminder, onSet, onClear, onClose }: ReminderPickerProps) {
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('09:00')

  const handleCustom = () => {
    if (!customDate) return
    const [year, month, day] = customDate.split('-').map(Number)
    const [hours, minutes] = customTime.split(':').map(Number)
    const date = new Date(year, month - 1, day, hours, minutes)
    if (date > new Date()) {
      onSet(date)
    }
  }

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute left-0 bottom-full mb-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-2 min-w-[220px]">
        {/* Current reminder display */}
        {currentReminder && (
          <div className="px-4 py-2 border-b border-outline-variant/10">
            <p className="text-xs text-on-surface-variant">
              Reminder set for
            </p>
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
              onClick={() => { onClear(); onClose() }}
              className="text-xs text-error/70 hover:text-error mt-1 cursor-pointer"
            >
              Remove reminder
            </button>
          </div>
        )}

        {/* Quick options */}
        {quickOptions.map((opt) => (
          <button
            key={opt.label}
            onClick={() => { onSet(opt.getDate()); onClose() }}
            className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer min-h-[44px]"
          >
            {opt.label}
          </button>
        ))}

        {/* Custom date/time */}
        <div className="border-t border-outline-variant/10 px-4 py-2.5 space-y-2">
          <p className="text-xs text-on-surface-variant font-medium">Custom</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={customDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setCustomDate(e.target.value)}
              className="flex-1 bg-surface-container rounded-lg px-3 py-2.5 text-base text-on-surface outline-none min-h-[44px]"
            />
            <input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="w-24 bg-surface-container rounded-lg px-3 py-2.5 text-base text-on-surface outline-none min-h-[44px]"
            />
          </div>
          <button
            onClick={handleCustom}
            disabled={!customDate}
            className="w-full text-sm px-3 py-2.5 rounded-lg bg-primary text-on-primary font-medium disabled:opacity-40 cursor-pointer min-h-[44px]"
          >
            Set reminder
          </button>
        </div>
      </div>
    </>
  )
}
