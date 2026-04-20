import { useState, useMemo, useEffect } from 'react'
import { useEvents } from '@/hooks/useEvents'
import { useTodos } from '@/hooks/useTodos'
import {
  getCalendarGridDays,
  isSameDay,
  isSameMonth,
  isToday,
  monthName,
  formatTime,
  toISODateString,
} from '@/lib/dateUtils'
import { describeRecurrence } from '@/lib/recurrence'
import type { CalendarEvent, Todo } from '@/types'
import { MenuButton } from '@/components/ui/MenuButton'
import type { AddEventInput } from '@/hooks/useEvents'

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const EVENT_COLORS: Record<NonNullable<CalendarEvent['color']>, string> = {
  primary: 'bg-primary',
  tertiary: 'bg-primary-dim',
  error: 'bg-error',
  neutral: 'bg-on-surface-variant',
}

export function CalendarPage() {
  const { events, loading: eventsLoading, addEvent, updateEvent, removeEvent } = useEvents()
  const { todos, completeTodo, deferTodo, loading: todosLoading } = useTodos()
  const loading = eventsLoading || todosLoading

  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const gridDays = useMemo(
    () => getCalendarGridDays(year, month),
    [year, month],
  )

  // Todos with due dates (non-done)
  const todosWithDueDates = useMemo(
    () => todos.filter((t) => t.due_date && t.status !== 'done'),
    [todos],
  )

  // Map: ISO date string -> items for that day
  const dayItemsMap = useMemo(() => {
    const map: Record<string, { events: CalendarEvent[]; todos: Todo[] }> = {}

    for (const event of events) {
      const key = toISODateString(event.start_time)
      if (!map[key]) map[key] = { events: [], todos: [] }
      map[key].events.push(event)
    }

    for (const todo of todosWithDueDates) {
      if (!todo.due_date) continue
      const key = toISODateString(todo.due_date)
      if (!map[key]) map[key] = { events: [], todos: [] }
      map[key].todos.push(todo)
    }

    return map
  }, [events, todosWithDueDates])

  const navigateMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1)
    setViewDate(next)
  }

  const goToToday = () => {
    const today = new Date()
    setViewDate(today)
    setSelectedDate(today)
  }

  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return null
    const key = toISODateString(selectedDate)
    return dayItemsMap[key] ?? { events: [], todos: [] }
  }, [selectedDate, dayItemsMap])

  // Auto-select today on first load
  useEffect(() => {
    if (!selectedDate) setSelectedDate(new Date())
  }, [])

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Calendar
          </h1>
          <p className="text-on-surface-variant text-sm">
            {monthName(viewDate)} {year}
          </p>
        </div>
        <MenuButton />
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-200 cursor-pointer"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>

        <button
          onClick={goToToday}
          className="text-sm font-medium text-primary hover:text-primary/80 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors duration-200 cursor-pointer"
        >
          Today
        </button>

        <button
          onClick={() => navigateMonth(1)}
          className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-200 cursor-pointer"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4l6 6-6 6" />
          </svg>
        </button>
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm py-8 text-center">Loading...</p>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="mb-6">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAY_HEADERS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-on-surface-variant py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {gridDays.map((day, i) => {
                const key = toISODateString(day)
                const items = dayItemsMap[key]
                const inMonth = isSameMonth(day, viewDate)
                const today = isToday(day)
                const selected = selectedDate ? isSameDay(day, selectedDate) : false
                const hasEvents = items && items.events.length > 0
                const hasTodos = items && items.todos.length > 0

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(day)}
                    className={`relative flex flex-col items-center py-2.5 cursor-pointer transition-all duration-200 rounded-xl ${
                      selected
                        ? 'bg-primary/10'
                        : 'hover:bg-surface-container'
                    } ${!inMonth ? 'opacity-30' : ''}`}
                  >
                    <span
                      className={`text-sm w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 ${
                        today && selected
                          ? 'bg-primary text-on-primary font-semibold'
                          : today
                            ? 'bg-primary/15 text-primary font-semibold'
                            : selected
                              ? 'text-primary font-medium'
                              : 'text-on-surface'
                      }`}
                    >
                      {day.getDate()}
                    </span>

                    {/* Dot indicators */}
                    {(hasEvents || hasTodos) && (
                      <div className="flex items-center gap-1 mt-1">
                        {hasEvents && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                        {hasTodos && (
                          <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant" />
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Day detail panel */}
          {selectedDate && (
            <DayDetailPanel
              date={selectedDate}
              items={selectedDayItems}
              onAddEvent={() => {
                setEditingEvent(null)
                setShowEventForm(true)
              }}
              onEditEvent={(event) => {
                setEditingEvent(event)
                setShowEventForm(true)
              }}
              onDeleteEvent={removeEvent}
              onCompleteTodo={completeTodo}
              onDeferTodo={deferTodo}
            />
          )}

          {/* Event form modal */}
          {showEventForm && selectedDate && (
            <EventFormModal
              date={selectedDate}
              event={editingEvent}
              onSave={async (input: AddEventInput) => {
                if (editingEvent) {
                  await updateEvent(editingEvent.id, {
                    title: input.title,
                    start_time: input.start_time,
                    end_time: input.end_time,
                    all_day: input.all_day,
                    description: input.description,
                    location: input.location,
                    color: input.color,
                  })
                } else {
                  await addEvent(input)
                }
                setShowEventForm(false)
                setEditingEvent(null)
              }}
              onClose={() => {
                setShowEventForm(false)
                setEditingEvent(null)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

// --- Day Detail Panel ---

interface DayDetailPanelProps {
  date: Date
  items: { events: CalendarEvent[]; todos: Todo[] } | null
  onAddEvent: () => void
  onEditEvent: (event: CalendarEvent) => void
  onDeleteEvent: (id: string) => void
  onCompleteTodo: (id: string) => void
  onDeferTodo: (id: string, until?: Date) => void
}

function DayDetailPanel({
  date,
  items,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onCompleteTodo,
}: DayDetailPanelProps) {
  const dayEvents = items?.events ?? []
  const dayTodos = items?.todos ?? []
  const empty = dayEvents.length === 0 && dayTodos.length === 0

  const sortedEvents = useMemo(
    () => [...dayEvents].sort((a, b) => {
      if (a.all_day && !b.all_day) return -1
      if (!a.all_day && b.all_day) return 1
      return a.start_time.getTime() - b.start_time.getTime()
    }),
    [dayEvents],
  )

  return (
    <div className="bg-surface-container-low rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold text-on-surface">
          {date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </h2>
        <button
          onClick={onAddEvent}
          className="text-xs font-medium text-primary hover:text-primary/80 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 transition-colors duration-200 cursor-pointer"
        >
          + Event
        </button>
      </div>

      {empty && (
        <p className="text-on-surface-variant text-sm py-4 text-center">
          Nothing scheduled
        </p>
      )}

      {/* Events */}
      {sortedEvents.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
            Events
          </p>
          <div className="space-y-1.5">
            {sortedEvents.map((event) => (
              <div
                key={event.id}
                className="group flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-surface-container transition-colors duration-200 cursor-pointer"
                onClick={() => onEditEvent(event)}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                    EVENT_COLORS[event.color ?? 'primary']
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-on-surface leading-snug">
                    {event.title}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {event.all_day
                      ? 'All day'
                      : `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`}
                    {event.location && ` \u00B7 ${event.location}`}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteEvent(event.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-error/60 hover:text-error p-1 rounded-lg hover:bg-error/5 transition-all duration-200 cursor-pointer flex-shrink-0"
                  aria-label="Delete event"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 3l8 8M11 3l-8 8" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Todos due this day */}
      {dayTodos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
            Due
          </p>
          <div className="space-y-1">
            {dayTodos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-surface-container transition-colors duration-200"
              >
                <button
                  onClick={() => onCompleteTodo(todo.id)}
                  className="mt-0.5 w-4.5 h-4.5 rounded-full border-2 border-outline-variant hover:border-primary hover:bg-primary/10 flex-shrink-0 transition-all duration-300 cursor-pointer"
                  aria-label={`Complete "${todo.title}"`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-on-surface leading-snug">
                    {todo.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {todo.project && (
                      <span className="text-xs text-on-surface-variant">
                        {todo.project}
                      </span>
                    )}
                    {todo.recurrence && (
                      <span className="text-xs text-on-surface-variant">
                        {describeRecurrence(todo.recurrence)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Event Form Modal ---

interface EventFormModalProps {
  date: Date
  event: CalendarEvent | null
  onSave: (input: AddEventInput) => Promise<void>
  onClose: () => void
}

function EventFormModal({ date, event, onSave, onClose }: EventFormModalProps) {
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
