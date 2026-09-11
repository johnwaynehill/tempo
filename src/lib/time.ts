/**
 * Time-estimate math shared by Today, Focus Mode, and Plan My Day.
 * Pure functions only, so they can be exercised from a script without React.
 */

export interface Estimable {
  estimated_minutes?: number
  size?: string
}

/** What the projection needs to know about the running timer. */
export interface TimerSnapshot {
  activeTaskId: string | null
  elapsedSeconds: number
}

/** Default estimate by todo size, used when the user hasn't set one. */
export function defaultEstimate(size?: string): number {
  switch (size) {
    case 'small': return 15
    case 'medium': return 30
    case 'large': return 60
    default: return 25
  }
}

export function getEstimate(todo: Estimable): number {
  return todo.estimated_minutes ?? defaultEstimate(todo.size)
}

export function totalEstimatedMinutes(todos: Estimable[]): number {
  return todos.reduce((sum, t) => sum + getEstimate(t), 0)
}

/**
 * Seconds of planned work left across `todos`. The active task contributes
 * whatever is left of its own estimate (never negative, so running over on one
 * task doesn't eat into the others); every other task contributes its full estimate.
 */
export function remainingSeconds(
  todos: (Estimable & { id: string })[],
  timer: TimerSnapshot | null,
): number {
  let seconds = 0
  for (const todo of todos) {
    const estimate = getEstimate(todo) * 60
    if (timer && timer.activeTaskId === todo.id) {
      seconds += Math.max(0, estimate - timer.elapsedSeconds)
    } else {
      seconds += estimate
    }
  }
  return seconds
}

export function remainingMinutes(
  todos: (Estimable & { id: string })[],
  timer: TimerSnapshot | null,
): number {
  return Math.ceil(remainingSeconds(todos, timer) / 60)
}

/** When the day's remaining work would finish if it started now and ran back to back. */
export function projectedEndTime(
  todos: (Estimable & { id: string })[],
  timer: TimerSnapshot | null,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() + remainingSeconds(todos, timer) * 1000)
}

/** "4:37 PM" */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Seconds as "12:45" or "1:02:30". */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Minutes as "1h 30m" or "25m". */
export function formatMinutes(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins}m`
}
