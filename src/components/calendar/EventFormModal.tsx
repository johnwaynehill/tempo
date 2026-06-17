import { useState, useEffect } from 'react'
import type { CalendarEvent } from '@/types'
import type { AddEventInput } from '@/hooks/useEvents'

interface EventFormModalProps {
  date: Date
  event: CalendarEvent | null
  onSave: (input: AddEventInput) => Promise<void>
  onClose: () => void
}

export function EventFormModal({ date, event, onSave, onClose }: EventFormModalProps) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [allDay, setAllDay] = useState(event?.all_day ?? true)
  const [startTime, setStartTime] = useState(() => {
    if (event && !event.all_day) {
      return `${String(event.start_time.getHours()).padStart(2, '0')}:${String(event.start_time.getMinutes()).padStart(2, '0')}`
    }
    return '09:00'
  })
  const [endTime, setEndTime] = useState(() => {
    if (event && !event.all_day) {
      return `${String(event.end_time.getHours()).padStart(2, '0')}:${String(event.end_time.getMinutes()).padStart(2, '0')}`
    }
    return '10:00'
  })
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [color, setColor] = useState<CalendarEvent['color']>(event?.color ?? 'primary')
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)

    const start = new Date(date)
    start.setHours(allDay ? 0 : startH, allDay ? 0 : startM, 0, 0)

    const end = new Date(date)
    end.setHours(allDay ? 23 : endH, allDay ? 59 : endM, allDay ? 59 : 0, 0)

    await onSave({
      title: title.trim(),
      start_time: start,
      end_time: end,
      all_day: allDay,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      color,
    })
  }

  const colorOptions: { value: CalendarEvent['color']; label: string; cls: string }[] = [
    { value: 'primary', label: 'Green', cls: 'bg-primary' },
    { value: 'tertiary', label: 'Sage', cls: 'bg-primary-dim' },
    { value: 'error', label: 'Red', cls: 'bg-error' },
    { value: 'neutral', label: 'Gray', cls: 'bg-on-surface-variant' },
  ]

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />
      <div
        className={`relative bg-surface-container-lowest rounded-2xl shadow-xl p-6 w-[min(420px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto transition-transform duration-200 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold text-on-surface mb-1">
          {event ? 'Edit Event' : 'New Event'}
        </h2>
        <p className="text-on-surface-variant text-xs mb-5">
          {date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface text-sm outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors placeholder:text-on-surface-variant/40"
          />

          {/* All day toggle */}
          <button
            type="button"
            onClick={() => setAllDay(!allDay)}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className={`w-9 h-5 rounded-full transition-colors duration-200 relative ${
              allDay ? 'bg-primary' : 'bg-surface-container-high'
            }`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-surface-container-lowest shadow-sm transition-transform duration-200 ${
                allDay ? 'translate-x-4' : ''
              }`} />
            </div>
            <span className="text-sm text-on-surface">All day</span>
          </button>

          {/* Time inputs */}
          {!allDay && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-on-surface-variant mb-1 block">Start</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container text-on-surface text-sm outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-on-surface-variant mb-1 block">End</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container text-on-surface text-sm outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Location */}
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface text-sm outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors placeholder:text-on-surface-variant/40"
          />

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface text-sm outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors placeholder:text-on-surface-variant/40 resize-none"
          />

          {/* Color picker */}
          <div>
            <p className="text-xs text-on-surface-variant mb-2">Color</p>
            <div className="flex gap-2">
              {colorOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(opt.value)}
                  className={`w-7 h-7 rounded-full ${opt.cls} transition-all duration-200 cursor-pointer ${
                    color === opt.value
                      ? 'ring-2 ring-offset-2 ring-primary ring-offset-surface-container-lowest scale-110'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  aria-label={opt.label}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200 cursor-pointer"
            >
              {saving ? 'Saving...' : event ? 'Update' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
