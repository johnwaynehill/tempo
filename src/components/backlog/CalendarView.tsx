import { useState, useMemo, useEffect } from 'react'
import { useEvents } from '@/hooks/useEvents'
import {
  getCalendarGridDays,
  isSameDay,
  isSameMonth,
  isToday,
  monthName,
  toISODateString,
} from '@/lib/dateUtils'
import type { CalendarEvent, Todo } from '@/types'
import type { AddEventInput } from '@/hooks/useEvents'
import { DayDetailPanel } from '@/components/calendar/DayDetailPanel'
import { EventFormModal } from '@/components/calendar/EventFormModal'
import { WEEKDAY_HEADERS } from '@/components/calendar/constants'

interface CalendarViewProps {
  /** Filtered todos (respects active project/energy filters) */
  todos: Todo[]
  onCompleteTodo: (id: string) => void
  onDeferTodo: (id: string, until?: Date) => void
}

export function CalendarView({ todos, onCompleteTodo, onDeferTodo }: CalendarViewProps) {
  const { events, addEvent, updateEvent, removeEvent } = useEvents()

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

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-on-surface">
            {monthName(viewDate)} {year}
          </span>
          <button
            onClick={goToToday}
            className="text-xs font-medium text-primary hover:text-primary/80 px-2.5 py-1 rounded-lg hover:bg-primary/5 transition-colors duration-200 cursor-pointer"
          >
            Today
          </button>
        </div>

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
          onCompleteTodo={onCompleteTodo}
          onDeferTodo={onDeferTodo}
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
    </div>
  )
}
