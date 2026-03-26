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

// --- Todo ---

export type TodoStatus = 'inbox' | 'today_pinned' | 'backlog' | 'deferred' | 'done'
export type TodoSize = 'small' | 'medium' | 'large'

export interface Todo {
  id: string
  title: string
  status: TodoStatus
  progress?: number
  project?: string
  size?: TodoSize
  impact?: number // 1–5
  energy_level?: EnergyLevel
  due_date?: Date
  supports?: string
  note_id?: string
  defer_until?: Date
  reminder_at?: Date
  dismissed_from_today?: Date
  created_at: Date
  updated_at: Date
  completed_at?: Date
}

// --- Note ---

export interface Note {
  id: string
  title: string
  content: string // Markdown source
  linked_todo_id?: string
  created_at: Date
  updated_at: Date
}

// --- User Preferences ---

export interface UserPreferences {
  current_energy?: EnergyLevel
  theme: 'light' | 'dark' | 'system'
  notifications_enabled: boolean
}
