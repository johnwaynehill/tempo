/** Tempo API client for MCP server */

const API_BASE = process.env.TEMPO_API_URL || 'https://tempo-api-production.up.railway.app'
const API_KEY = process.env.TEMPO_API_KEY || ''

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`API ${res.status}: ${(body as { error?: string }).error || res.statusText}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as T
}

// --- Types matching API response (camelCase from Drizzle) ---

export interface Todo {
  id: string
  title: string
  status: string
  progress?: number
  project?: string
  size?: string
  impact?: number
  energyLevel?: string
  dueDate?: string
  supports?: string
  noteId?: string
  deferUntil?: string
  reminderAt?: string
  recurrence?: unknown
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface Habit {
  id: string
  name: string
  description?: string
  frequency: string
  archived: boolean
  completions: Record<string, boolean>
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: string
  linkedTodoId?: string
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  allDay: boolean
  description?: string
  location?: string
  color?: string
  createdAt: string
  updatedAt: string
}

export interface WeeklyReview {
  id: string
  reflection: string
  createdAt: string
  updatedAt: string
}

// --- API methods ---

export const api = {
  todos: {
    list: () => apiFetch<Todo[]>('/api/todos'),
    get: (id: string) => apiFetch<Todo>(`/api/todos/${id}`),
    create: (data: Partial<Todo>) => apiFetch<Todo>('/api/todos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Todo>) => apiFetch<Todo>(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<void>(`/api/todos/${id}`, { method: 'DELETE' }),
  },
  habits: {
    list: () => apiFetch<Habit[]>('/api/habits'),
    toggleCompletion: (id: string, date: string, completed: boolean) =>
      apiFetch<Habit>(`/api/habits/${id}/completions`, { method: 'PATCH', body: JSON.stringify({ date, completed }) }),
  },
  notes: {
    list: () => apiFetch<Note[]>('/api/notes'),
    get: (id: string) => apiFetch<Note>(`/api/notes/${id}`),
    create: (data: Partial<Note>) => apiFetch<Note>('/api/notes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Note>) => apiFetch<Note>(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  events: {
    list: () => apiFetch<CalendarEvent[]>('/api/events'),
    create: (data: Partial<CalendarEvent>) => apiFetch<CalendarEvent>('/api/events', { method: 'POST', body: JSON.stringify(data) }),
  },
  reviews: {
    list: () => apiFetch<WeeklyReview[]>('/api/reviews'),
  },
  todaySet: {
    get: (date: string) => apiFetch<{ date: string; todoIds: string[] }>(`/api/today-set?date=${date}`),
  },
  preferences: {
    get: () => apiFetch<Record<string, unknown>>('/api/preferences'),
    update: (data: Record<string, unknown>) => apiFetch<Record<string, unknown>>('/api/preferences', { method: 'PUT', body: JSON.stringify(data) }),
  },
}
