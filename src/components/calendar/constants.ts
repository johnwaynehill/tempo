import type { CalendarEvent } from '@/types'

export const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const EVENT_COLORS: Record<NonNullable<CalendarEvent['color']>, string> = {
  primary: 'bg-primary',
  tertiary: 'bg-primary-dim',
  error: 'bg-error',
  neutral: 'bg-on-surface-variant',
}
