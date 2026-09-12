/**
 * Estimate calibration: how timed completions compared to their estimates.
 * Pure functions only, so they can be exercised from a script without React.
 */
import { getEstimate } from '@/lib/time'

export interface TimedTodo {
  estimated_minutes?: number
  actual_minutes?: number
  size?: string
  project?: string
  completed_at?: Date
}

export interface CalibrationGroup {
  key: string
  count: number
  estimatedMinutes: number
  actualMinutes: number
  /** actual / estimated */
  ratio: number
}

export interface Calibration {
  timedCount: number
  estimatedMinutes: number
  actualMinutes: number
  /** actual / estimated across all timed todos; null below MIN_TIMED. */
  ratio: number | null
  bySize: CalibrationGroup[]
  /** Sorted by count, most-timed project first. */
  byProject: CalibrationGroup[]
}

/** Below this many timed completions there is nothing trustworthy to say. */
export const MIN_TIMED = 3

const SIZE_ORDER = ['small', 'medium', 'large', 'unsized']

export function isTimed(todo: TimedTodo): boolean {
  return typeof todo.actual_minutes === 'number' && todo.actual_minutes > 0
}

function groupBy(todos: TimedTodo[], keyOf: (t: TimedTodo) => string): CalibrationGroup[] {
  const map = new Map<string, { count: number; estimatedMinutes: number; actualMinutes: number }>()
  for (const t of todos) {
    const key = keyOf(t)
    const g = map.get(key) ?? { count: 0, estimatedMinutes: 0, actualMinutes: 0 }
    g.count++
    g.estimatedMinutes += getEstimate(t)
    g.actualMinutes += t.actual_minutes!
    map.set(key, g)
  }
  return [...map.entries()].map(([key, g]) => ({ key, ...g, ratio: g.actualMinutes / g.estimatedMinutes }))
}

export function computeCalibration(todos: TimedTodo[]): Calibration {
  const timed = todos.filter(isTimed)
  const estimatedMinutes = timed.reduce((sum, t) => sum + getEstimate(t), 0)
  const actualMinutes = timed.reduce((sum, t) => sum + t.actual_minutes!, 0)

  const bySize = groupBy(timed, (t) => t.size ?? 'unsized')
    .sort((a, b) => SIZE_ORDER.indexOf(a.key) - SIZE_ORDER.indexOf(b.key))
  const byProject = groupBy(timed, (t) => t.project || 'Ungrouped')
    .sort((a, b) => b.count - a.count)

  return {
    timedCount: timed.length,
    estimatedMinutes,
    actualMinutes,
    ratio: timed.length >= MIN_TIMED && estimatedMinutes > 0 ? actualMinutes / estimatedMinutes : null,
    bySize,
    byProject,
  }
}

/** One neutral sentence about the overall ratio, or null when there isn't enough data. */
export function calibrationHeadline(c: Calibration): string | null {
  if (c.ratio === null) return null
  if (c.ratio >= 0.85 && c.ratio <= 1.15) return 'Your estimates were close this week.'
  const pct = Math.round(Math.abs(c.ratio - 1) * 100)
  return c.ratio > 1
    ? `Tasks ran about ${pct}% longer than you guessed.`
    : `Tasks finished about ${pct}% faster than you guessed.`
}

export const SIZE_LABEL: Record<string, string> = { small: 'Small', medium: 'Medium', large: 'Large', unsized: 'Unsized' }

/**
 * The first group (size first, then project) that ran at least 1.3× over with
 * enough completions to mean something. Null when nothing stands out.
 */
export function calibrationPattern(c: Calibration): string | null {
  const over = (g: CalibrationGroup) => g.count >= MIN_TIMED && g.ratio >= 1.3
  const size = c.bySize.find(over)
  if (size) return `${SIZE_LABEL[size.key] ?? size.key} tasks tend to take about ${size.ratio.toFixed(1)}× your estimate.`
  const project = c.byProject.find(over)
  if (project) return `${project.key} tasks tend to take about ${project.ratio.toFixed(1)}× your estimate.`
  return null
}

/**
 * Typical actual minutes for a size over the last `windowDays` of timed
 * completions, rounded to the nearest 5. Null below MIN_TIMED. Feeds the hint
 * under the estimate chips.
 */
export function typicalMinutesForSize(todos: TimedTodo[], size: string, windowDays = 28, now = new Date()): number | null {
  const since = new Date(now.getTime() - windowDays * 86400000)
  const sample = todos.filter(
    (t) => isTimed(t) && t.size === size && t.completed_at !== undefined && t.completed_at >= since,
  )
  if (sample.length < MIN_TIMED) return null
  const mean = sample.reduce((sum, t) => sum + t.actual_minutes!, 0) / sample.length
  return Math.max(5, Math.round(mean / 5) * 5)
}
