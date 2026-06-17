import { useMemo } from 'react'
import { formatTime } from '@/lib/dateUtils'
import { describeRecurrence } from '@/lib/recurrence'
import type { CalendarEvent, Todo } from '@/types'
import { EVENT_COLORS } from './constants'

interface DayDetailPanelProps {
  date: Date
  items: { events: CalendarEvent[]; todos: Todo[] } | null
  onAddEvent: () => void
  onEditEvent: (event: CalendarEvent) => void
  onDeleteEvent: (id: string) => void
  onCompleteTodo: (id: string) => void
  onDeferTodo: (id: string, until?: Date) => void
}

export function DayDetailPanel({
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
            {sortedEvents.map((event) => {
              const isGoogle = event.source === 'google'
              return (
                <div
                  key={event.id}
                  className={`group flex items-start gap-3 py-2.5 px-3 rounded-xl transition-colors duration-200 ${
                    isGoogle ? 'cursor-default' : 'hover:bg-surface-container cursor-pointer'
                  }`}
                  onClick={isGoogle ? undefined : () => onEditEvent(event)}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                      isGoogle ? 'bg-primary-dim' : EVENT_COLORS[event.color ?? 'primary']
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-on-surface leading-snug truncate">
                      {event.title}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {event.all_day
                        ? 'All day'
                        : `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`}
                      {event.location && ` · ${event.location}`}
                    </p>
                  </div>
                  {!isGoogle && (
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
                  )}
                </div>
              )
            })}
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
