import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useEvents } from '@/hooks/useEvents'
import { formatTime, dayAbbrev, startOfDay, toISODateString } from '@/lib/dateUtils'
import type { CalendarEvent } from '@/types'

const DOT_COLORS: Record<NonNullable<CalendarEvent['color']>, string> = {
  primary: 'bg-primary',
  tertiary: 'bg-primary-dim',
  error: 'bg-error',
  neutral: 'bg-on-surface-variant',
}

const UPCOMING_DAYS = 3

const byStartTime = (a: CalendarEvent, b: CalendarEvent) =>
  a.start_time.getTime() - b.start_time.getTime()

/**
 * Splits the user's events into "today" and the next {@link UPCOMING_DAYS} days.
 * Source-agnostic — native Tempo events and mirrored Google events are treated
 * the same. All-day events sort to the top of their day.
 */
function splitDayEvents(events: CalendarEvent[]) {
  const today = startOfDay(new Date())
  const todayKey = toISODateString(today)

  const upcomingKeys = new Set(
    Array.from({ length: UPCOMING_DAYS }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i + 1)
      return toISODateString(d)
    }),
  )

  const todayEvents: CalendarEvent[] = []
  const upcomingEvents: CalendarEvent[] = []
  for (const e of events) {
    const key = toISODateString(e.start_time)
    if (key === todayKey) todayEvents.push(e)
    else if (upcomingKeys.has(key)) upcomingEvents.push(e)
  }

  const allDayFirst = (a: CalendarEvent, b: CalendarEvent) =>
    a.all_day === b.all_day ? byStartTime(a, b) : a.all_day ? -1 : 1

  return {
    todayEvents: todayEvents.sort(allDayFirst),
    upcomingEvents: upcomingEvents.sort(byStartTime),
  }
}

function useDayEvents() {
  const { events } = useEvents()
  return useMemo(() => splitDayEvents(events), [events])
}

const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center'

function EventRow({
  event,
  mode,
  onOpenDay,
}: {
  event: CalendarEvent
  mode: 'today' | 'upcoming'
  onOpenDay: (date: Date) => void
}) {
  return (
    <button
      onClick={() => onOpenDay(event.start_time)}
      className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container transition-colors duration-200 cursor-pointer text-left min-h-[44px]"
    >
      {mode === 'today' ? (
        <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[event.color ?? 'primary']}`} />
      ) : (
        <span className="shrink-0 w-10 text-center text-[11px] font-medium text-on-surface-variant bg-surface-container rounded-md px-1.5 py-0.5">
          {dayAbbrev(event.start_time)}
        </span>
      )}
      <span className="flex-1 min-w-0 text-sm text-on-surface truncate">
        {event.title}
        {event.location && <span className="text-on-surface-variant"> · {event.location}</span>}
      </span>
      <span className="shrink-0 text-xs text-on-surface-variant tabular-nums">
        {event.all_day ? 'All day' : formatTime(event.start_time)}
      </span>
    </button>
  )
}

function useOpenDay() {
  const navigate = useNavigate()
  return (date: Date) => navigate(`/backlog?view=calendar&date=${toISODateString(date)}`)
}

/** "Today's events" — sits above the task list; always renders (quiet placeholder when empty). */
export function TodaysEvents() {
  const { todayEvents } = useDayEvents()
  const openDay = useOpenDay()

  return (
    <section className="mb-6">
      <p className={SECTION_LABEL}>
        Today&rsquo;s events
        {todayEvents.length > 0 && (
          <span className="ml-2 text-[11px] font-medium text-primary bg-primary-container rounded-full px-1.5">
            {todayEvents.length}
          </span>
        )}
      </p>
      <div className="bg-surface-container-lowest rounded-2xl p-1.5">
        {todayEvents.length === 0 ? (
          <p className="px-3 py-3 text-sm text-on-surface-variant/70">No events today</p>
        ) : (
          todayEvents.map((e) => <EventRow key={e.id} event={e} mode="today" onOpenDay={openDay} />)
        )}
      </div>
    </section>
  )
}

/** "Next 3 days" — sits below the task list; hidden entirely when there's nothing upcoming. */
export function UpcomingEvents() {
  const { upcomingEvents } = useDayEvents()
  const openDay = useOpenDay()

  if (upcomingEvents.length === 0) return null

  return (
    <section className="mt-8">
      <p className={SECTION_LABEL}>Next 3 days</p>
      <div className="bg-surface-container-lowest rounded-2xl p-1.5">
        {upcomingEvents.map((e) => <EventRow key={e.id} event={e} mode="upcoming" onOpenDay={openDay} />)}
      </div>
    </section>
  )
}
