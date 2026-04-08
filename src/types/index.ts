// --- Energy ---

export const ENERGY_LEVELS = ['low', 'medium_low', 'medium', 'high'] as const
export type EnergyLevel = (typeof ENERGY_LEVELS)[number]

export const ENERGY_ORDINAL: Record<EnergyLevel, number> = {
  low: 0,
  medium_low: 1,
  medium: 2,
  high: 3,
}

export const ENERGY_LABELS: Record<EnergyLevel, string> = {
  low: 'Low',
  medium_low: 'Med-Low',
  medium: 'Medium',
  high: 'High',
}

// --- Chip Color Helpers ---

/** Deterministic hash of a project name → palette index (0–7) */
export function projectColorIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return ((hash % 8) + 8) % 8
}

/** CSS variable pair for a project chip */
export function projectChipStyle(name: string) {
  const i = projectColorIndex(name)
  return { background: `var(--color-project-${i}-bg)`, color: `var(--color-project-${i}-fg)` }
}

/** CSS variable pair for an energy chip */
export const ENERGY_CHIP_STYLE: Record<EnergyLevel, { background: string; color: string }> = {
  low: { background: 'var(--color-energy-low-bg)', color: 'var(--color-energy-low-fg)' },
  medium_low: { background: 'var(--color-energy-medlow-bg)', color: 'var(--color-energy-medlow-fg)' },
  medium: { background: 'var(--color-energy-medium-bg)', color: 'var(--color-energy-medium-fg)' },
  high: { background: 'var(--color-energy-high-bg)', color: 'var(--color-energy-high-fg)' },
}

/** CSS variable pair for a size chip */
export const SIZE_CHIP_STYLE: Record<TodoSize, { background: string; color: string }> = {
  small: { background: 'var(--color-size-small-bg)', color: 'var(--color-size-small-fg)' },
  medium: { background: 'var(--color-size-medium-bg)', color: 'var(--color-size-medium-fg)' },
  large: { background: 'var(--color-size-large-bg)', color: 'var(--color-size-large-fg)' },
}

/** CSS variable pair for an impact chip */
export function impactChipStyle(impact: number) {
  const i = Math.max(1, Math.min(5, impact))
  return { background: `var(--color-impact-${i}-bg)`, color: `var(--color-impact-${i}-fg)` }
}

// --- Todo ---

export type TodoStatus = 'inbox' | 'today_pinned' | 'backlog' | 'deferred' | 'done'
export type TodoSize = 'small' | 'medium' | 'large'
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  days_of_week?: number[]  // 0=Sun, 1=Mon, ..., 6=Sat (for weekly)
  day_of_month?: number    // 1-31 (for monthly)
}

export interface Todo {
  id: string
  title: string
  status: TodoStatus
  progress?: number
  project?: string
  size?: TodoSize
  impact?: number // 1–5
  energy_level?: EnergyLevel
  estimated_minutes?: number
  due_date?: Date
  supports?: string
  note_id?: string
  defer_until?: Date
  reminder_at?: Date
  dismissed_from_today?: Date
  recurrence?: RecurrenceRule
  recurrence_parent_id?: string
  created_at: Date
  updated_at: Date
  completed_at?: Date
}

// --- Note ---

export interface Note {
  id: string
  title: string
  content: string // Markdown source
  projects: string[] // Project names via hashtags
  linked_todo_id?: string
  inline_todo_map?: Record<string, string> // checkboxId -> todoId
  created_at: Date
  updated_at: Date
}

export interface Project {
  id: string
  name: string
  created_at: Date
  updated_at: Date
}

// --- Today Set ---

export interface TodaySet {
  date: string       // ISO date string, e.g. "2026-03-29"
  todo_ids: string[] // IDs of the todos selected for the day
}

// --- Weekly Review ---

export interface WeeklyReview {
  id: string           // week Monday ISO date, e.g. "2026-03-23"
  reflection: string   // free-text reflection
  created_at: Date
  updated_at: Date
}

// --- Habit ---

export interface Habit {
  id: string
  name: string
  description?: string
  frequency: 'daily'  // Future: 'weekly' | 'custom'
  archived: boolean
  completions: Record<string, boolean>  // { "2026-03-29": true }
  created_at: Date
  updated_at: Date
}

// --- Calendar Event ---

export interface CalendarEvent {
  id: string
  title: string
  start_time: Date
  end_time: Date
  all_day: boolean
  description?: string
  location?: string
  color?: 'primary' | 'tertiary' | 'error' | 'neutral'
  created_at: Date
  updated_at: Date
}

// --- Playlist ---

export interface PlaylistItem {
  id: string
  playlist_id: string
  title: string
  sort_order: number
  size?: TodoSize
  energy_level?: EnergyLevel
  estimated_minutes?: number
  project?: string
}

export interface Playlist {
  id: string
  name: string
  description?: string
  items: PlaylistItem[]
  created_at: Date
  updated_at: Date
}

// --- Mood ---

export interface MoodEntry {
  id: string
  value: number        // 1-100
  note?: string
  created_at: Date
}

export const MOOD_ANCHORS = [
  { value: 1,   label: 'Awful' },
  { value: 25,  label: 'Low' },
  { value: 50,  label: 'Okay' },
  { value: 75,  label: 'Good' },
  { value: 100, label: 'Great' },
] as const

// --- User Preferences ---

export interface UserPreferences {
  current_energy?: EnergyLevel
  theme: 'light' | 'dark' | 'system'
  notifications_enabled: boolean
  adaptive_theme: boolean
}
