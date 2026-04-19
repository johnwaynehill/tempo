import type { Todo, EnergyLevel } from '@/types'
import { ENERGY_ORDINAL } from '@/types'

/**
 * Today View Auto-Suggest Scoring Algorithm
 *
 * score =
 *   (due_date_urgency × 40)      # 0–1 scale
 * + (impact × 8)                  # impact 1–5 → 8–40 points
 * + (energy_match × 25)           # 1.0 if matches, 0.5 if adjacent, 0.0 if distant
 * + (staleness × 10)              # days_in_backlog / 30, capped at 1.0
 */

function dueDateUrgency(dueDate?: Date): number {
  if (!dueDate) return 0.2 // No due date gets a neutral score

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  const daysUntil = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil < 0) return 1.0   // Overdue
  if (daysUntil === 0) return 1.0  // Due today
  if (daysUntil === 1) return 0.7  // Tomorrow
  if (daysUntil <= 7) return 0.4   // This week
  return 0.1                       // Later
}

function energyMatch(
  taskEnergy?: EnergyLevel,
  currentEnergy?: EnergyLevel,
): number {
  if (!taskEnergy || !currentEnergy) return 0.5 // Neutral if either is unset

  const distance = Math.abs(
    ENERGY_ORDINAL[taskEnergy] - ENERGY_ORDINAL[currentEnergy],
  )

  if (distance === 0) return 1.0
  if (distance === 1) return 0.5
  return 0.0
}

function staleness(createdAt: Date): number {
  const days = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  return Math.min(days / 30, 1.0)
}

export function scoreTodo(todo: Todo, currentEnergy?: EnergyLevel): number {
  return (
    dueDateUrgency(todo.due_date) * 40 +
    (todo.impact ?? 3) * 8 +
    energyMatch(todo.energy_level, currentEnergy) * 25 +
    staleness(todo.created_at) * 10
  )
}

/**
 * Returns up to `limit` auto-suggested todos, sorted by score descending.
 * Excludes: done, deferred (not yet due), today_pinned, dismissed today, inbox.
 */
export function suggestTodayTodos(
  todos: Todo[],
  currentEnergy?: EnergyLevel,
  pinnedCount: number = 0,
  limit: number = 5,
): Todo[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const candidates = todos.filter((t) => {
    if (t.status === 'done' || t.status === 'today_pinned') return false
    if (t.status === 'inbox') return false
    if (t.status === 'deferred' && t.defer_until && t.defer_until > now) return false
    if (
      t.dismissed_from_today &&
      t.dismissed_from_today >= today
    ) return false
    return true
  })

  const scored = candidates.map((todo) => ({
    todo,
    score: scoreTodo(todo, currentEnergy),
  }))

  scored.sort((a, b) => b.score - a.score)

  const slotsAvailable = Math.max(0, limit - pinnedCount)
  return scored.slice(0, slotsAvailable).map((s) => s.todo)
}
