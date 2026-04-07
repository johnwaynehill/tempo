import { auth } from '@/lib/firebase'

const API_BASE = import.meta.env.VITE_API_URL || 'https://tempo-api-production.up.railway.app'

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const token = await user.getIdToken()
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `API error: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// --- Case converters ---
// API returns camelCase (Drizzle), frontend types use snake_case

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function mapKeys(obj: Record<string, unknown>, fn: (k: string) => string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    result[fn(k)] = v
  }
  return result
}

/** Convert API response (camelCase) to frontend type (snake_case) with date parsing */
function fromApi<T>(obj: Record<string, unknown>, dateFields: string[]): T {
  const snaked = mapKeys(obj, camelToSnake)
  for (const field of dateFields) {
    const val = snaked[field]
    if (typeof val === 'string') {
      snaked[field] = new Date(val)
    }
  }
  return snaked as T
}

/** Convert frontend type (snake_case) to API request (camelCase) */
function toApi(obj: Record<string, unknown>): Record<string, unknown> {
  return mapKeys(obj, snakeToCamel)
}

const TODO_DATES = ['due_date', 'defer_until', 'reminder_at', 'dismissed_from_today', 'created_at', 'updated_at', 'completed_at']
const TIMESTAMP_DATES = ['created_at', 'updated_at']
const EVENT_DATES = ['start_time', 'end_time', 'created_at', 'updated_at']

// --- API methods ---

export const api = {
  todos: {
    list: () => apiFetch<Record<string, unknown>[]>('/api/todos')
      .then(rows => rows.map(r => fromApi(r, TODO_DATES))),
    create: (data: Record<string, unknown>) => apiFetch<Record<string, unknown>>('/api/todos', {
      method: 'POST', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, TODO_DATES)),
    update: (id: string, data: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/api/todos/${id}`, {
      method: 'PUT', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, TODO_DATES)),
    delete: (id: string) => apiFetch<void>(`/api/todos/${id}`, { method: 'DELETE' }),
  },
  notes: {
    list: () => apiFetch<Record<string, unknown>[]>('/api/notes')
      .then(rows => rows.map(r => fromApi(r, TIMESTAMP_DATES))),
    create: (data: Record<string, unknown>) => apiFetch<Record<string, unknown>>('/api/notes', {
      method: 'POST', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, TIMESTAMP_DATES)),
    update: (id: string, data: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/api/notes/${id}`, {
      method: 'PUT', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, TIMESTAMP_DATES)),
    delete: (id: string) => apiFetch<void>(`/api/notes/${id}`, { method: 'DELETE' }),
  },
  habits: {
    list: () => apiFetch<Record<string, unknown>[]>('/api/habits')
      .then(rows => rows.map(r => fromApi(r, TIMESTAMP_DATES))),
    create: (data: Record<string, unknown>) => apiFetch<Record<string, unknown>>('/api/habits', {
      method: 'POST', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, TIMESTAMP_DATES)),
    update: (id: string, data: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/api/habits/${id}`, {
      method: 'PUT', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, TIMESTAMP_DATES)),
    toggleCompletion: (id: string, date: string, completed: boolean) =>
      apiFetch<Record<string, unknown>>(`/api/habits/${id}/completions`, {
        method: 'PATCH', body: JSON.stringify({ date, completed }),
      }).then(r => fromApi(r, TIMESTAMP_DATES)),
    delete: (id: string) => apiFetch<void>(`/api/habits/${id}`, { method: 'DELETE' }),
  },
  events: {
    list: () => apiFetch<Record<string, unknown>[]>('/api/events')
      .then(rows => rows.map(r => fromApi(r, EVENT_DATES))),
    create: (data: Record<string, unknown>) => apiFetch<Record<string, unknown>>('/api/events', {
      method: 'POST', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, EVENT_DATES)),
    update: (id: string, data: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/api/events/${id}`, {
      method: 'PUT', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, EVENT_DATES)),
    delete: (id: string) => apiFetch<void>(`/api/events/${id}`, { method: 'DELETE' }),
  },
  preferences: {
    get: () => apiFetch<Record<string, unknown>>('/api/preferences')
      .then(r => fromApi(r, [])),
    update: (data: Record<string, unknown>) => apiFetch<Record<string, unknown>>('/api/preferences', {
      method: 'PUT', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, [])),
  },
  todaySet: {
    get: (date: string) => apiFetch<{ userId: string; date: string; todoIds: string[] }>(`/api/today-set?date=${date}`),
    update: (data: { date: string; todoIds: string[] }) => apiFetch<Record<string, unknown>>('/api/today-set', {
      method: 'PUT', body: JSON.stringify(data),
    }),
  },
  reviews: {
    list: () => apiFetch<Record<string, unknown>[]>('/api/reviews')
      .then(rows => rows.map(r => fromApi(r, TIMESTAMP_DATES))),
    get: (id: string) => apiFetch<Record<string, unknown>>(`/api/reviews/${id}`)
      .then(r => fromApi(r, TIMESTAMP_DATES)),
    save: (id: string, data: { reflection: string }) => apiFetch<Record<string, unknown>>(`/api/reviews/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }).then(r => fromApi(r, TIMESTAMP_DATES)),
  },
  conversations: {
    list: () => apiFetch<Record<string, unknown>[]>('/api/conversations')
      .then(rows => rows.map(r => fromApi(r, TIMESTAMP_DATES))),
    get: (id: string) => apiFetch<Record<string, unknown>>(`/api/conversations/${id}`)
      .then(r => fromApi(r, TIMESTAMP_DATES)),
    save: (id: string, data: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/api/conversations/${id}`, {
      method: 'PUT', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, TIMESTAMP_DATES)),
    delete: (id: string) => apiFetch<void>(`/api/conversations/${id}`, { method: 'DELETE' }),
  },
  projects: {
    list: () => apiFetch<Record<string, unknown>[]>('/api/projects')
      .then(rows => rows.map(r => fromApi(r, TIMESTAMP_DATES))),
    create: (name: string) => apiFetch<Record<string, unknown>>('/api/projects', {
      method: 'POST', body: JSON.stringify({ name }),
    }).then(r => fromApi(r, TIMESTAMP_DATES)),
    update: (id: string, data: { name: string }) => apiFetch<Record<string, unknown>>(`/api/projects/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }).then(r => fromApi(r, TIMESTAMP_DATES)),
    delete: (id: string) => apiFetch<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  },
  playlists: {
    list: () => apiFetch<Record<string, unknown>[]>('/api/playlists')
      .then(rows => rows.map(r => {
        const p = fromApi<Record<string, unknown>>(r, TIMESTAMP_DATES)
        const items = (r.items as Record<string, unknown>[]) ?? []
        return { ...p, items: items.map(i => fromApi(i, [])) }
      })),
    get: (id: string) => apiFetch<Record<string, unknown>>(`/api/playlists/${id}`)
      .then(r => {
        const p = fromApi<Record<string, unknown>>(r, TIMESTAMP_DATES)
        const items = (r.items as Record<string, unknown>[]) ?? []
        return { ...p, items: items.map(i => fromApi(i, [])) }
      }),
    create: (data: Record<string, unknown>) => apiFetch<Record<string, unknown>>('/api/playlists', {
      method: 'POST', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, TIMESTAMP_DATES)),
    update: (id: string, data: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/api/playlists/${id}`, {
      method: 'PUT', body: JSON.stringify(toApi(data)),
    }).then(r => fromApi(r, TIMESTAMP_DATES)),
    delete: (id: string) => apiFetch<void>(`/api/playlists/${id}`, { method: 'DELETE' }),
    start: (id: string) => apiFetch<{ todoIds: string[]; count: number }>(`/api/playlists/${id}/start`, {
      method: 'POST',
    }),
  },
  apiKeys: {
    list: () => apiFetch<Record<string, unknown>[]>('/api/api-keys'),
    create: (name: string) => apiFetch<Record<string, unknown>>('/api/api-keys', {
      method: 'POST', body: JSON.stringify({ name }),
    }),
    delete: (id: string) => apiFetch<void>(`/api/api-keys/${id}`, { method: 'DELETE' }),
  },
}
