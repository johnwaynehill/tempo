#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { api } from './api.js'

const server = new McpServer({
  name: 'tempo',
  version: '1.0.0',
})

// --- Helper ---

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTodo(t: { id: string; title: string; status: string; project?: string; dueDate?: string; size?: string; impact?: number; energyLevel?: string; estimatedMinutes?: number }) {
  const parts = [`[${t.status}] ${t.title}`]
  if (t.project) parts.push(`project: ${t.project}`)
  if (t.dueDate) parts.push(`due: ${t.dueDate.slice(0, 10)}`)
  if (t.size) parts.push(`size: ${t.size}`)
  if (t.impact) parts.push(`impact: ${t.impact}`)
  if (t.energyLevel) parts.push(`energy: ${t.energyLevel}`)
  if (t.estimatedMinutes) parts.push(`${t.estimatedMinutes}m`)
  parts.push(`id: ${t.id}`)
  return parts.join(' | ')
}

// ========================
// TOOLS
// ========================

// --- List Todos ---
server.tool(
  'list_todos',
  'List all todos, optionally filtered by status or project',
  {
    status: z.enum(['inbox', 'today_pinned', 'backlog', 'deferred', 'done']).optional().describe('Filter by status'),
    project: z.string().optional().describe('Filter by project name'),
  },
  async ({ status, project }) => {
    let todos = await api.todos.list()
    if (status) todos = todos.filter(t => t.status === status)
    if (project) todos = todos.filter(t => t.project?.toLowerCase().includes(project.toLowerCase()))

    return {
      content: [{ type: 'text', text: todos.length === 0
        ? 'No todos found.'
        : todos.map(formatTodo).join('\n')
      }],
    }
  },
)

// --- Get Today's Todos ---
server.tool(
  'get_today',
  'Get the todos planned for today (pinned + auto-suggested)',
  {},
  async () => {
    const allTodos = await api.todos.list()
    const todaySet = await api.todaySet.get(todayStr())
    const pinned = allTodos.filter(t => t.status === 'today_pinned')
    const setIds = new Set(todaySet.todoIds || [])
    const pinnedIds = new Set(pinned.map(t => t.id))
    const fromSet = allTodos.filter(t => setIds.has(t.id) && !pinnedIds.has(t.id) && t.status !== 'done')

    const today = [...pinned, ...fromSet]
    return {
      content: [{ type: 'text', text: today.length === 0
        ? 'No todos planned for today.'
        : today.map(formatTodo).join('\n')
      }],
    }
  },
)

// --- Create Todo ---
server.tool(
  'create_todo',
  'Create a new todo',
  {
    title: z.string().describe('Todo title'),
    status: z.enum(['inbox', 'today_pinned', 'backlog']).default('inbox').describe('Initial status'),
    project: z.string().optional().describe('Project name'),
    size: z.enum(['small', 'medium', 'large']).optional().describe('Task size'),
    impact: z.number().min(1).max(5).optional().describe('Impact score 1-5'),
    energy_level: z.enum(['low', 'medium_low', 'medium', 'high']).optional().describe('Energy level required'),
    due_date: z.string().optional().describe('Due date (ISO format, e.g. 2026-04-10)'),
    estimated_minutes: z.number().optional().describe('Time estimate in minutes'),
  },
  async (input) => {
    const todo = await api.todos.create({
      title: input.title,
      status: input.status,
      project: input.project,
      size: input.size,
      impact: input.impact,
      energyLevel: input.energy_level,
      dueDate: input.due_date ? input.due_date + 'T00:00:00' : undefined,
      estimatedMinutes: input.estimated_minutes,
    } as Partial<import('./api.js').Todo>)

    return {
      content: [{ type: 'text', text: `Created todo: ${formatTodo(todo)}` }],
    }
  },
)

// --- Update Todo ---
server.tool(
  'update_todo',
  'Update an existing todo',
  {
    id: z.string().describe('Todo ID'),
    title: z.string().optional().describe('New title'),
    status: z.enum(['inbox', 'today_pinned', 'backlog', 'deferred', 'done']).optional().describe('New status'),
    project: z.string().optional().describe('Project name'),
    size: z.enum(['small', 'medium', 'large']).optional().describe('Task size'),
    impact: z.number().min(1).max(5).optional().describe('Impact score 1-5'),
    energy_level: z.enum(['low', 'medium_low', 'medium', 'high']).optional().describe('Energy level required'),
    due_date: z.string().optional().describe('Due date (ISO format, e.g. 2026-04-10)'),
    estimated_minutes: z.number().optional().describe('Time estimate in minutes'),
  },
  async ({ id, ...updates }) => {
    const data: Record<string, unknown> = {}
    if (updates.title !== undefined) data.title = updates.title
    if (updates.status !== undefined) data.status = updates.status
    if (updates.project !== undefined) data.project = updates.project
    if (updates.size !== undefined) data.size = updates.size
    if (updates.impact !== undefined) data.impact = updates.impact
    if (updates.energy_level !== undefined) data.energyLevel = updates.energy_level
    if (updates.due_date !== undefined) data.dueDate = updates.due_date + 'T00:00:00'
    if (updates.estimated_minutes !== undefined) data.estimatedMinutes = updates.estimated_minutes

    const todo = await api.todos.update(id, data as Partial<import('./api.js').Todo>)
    return {
      content: [{ type: 'text', text: `Updated: ${formatTodo(todo)}` }],
    }
  },
)

// --- Complete Todo ---
server.tool(
  'complete_todo',
  'Mark a todo as done',
  {
    id: z.string().describe('Todo ID'),
  },
  async ({ id }) => {
    const todo = await api.todos.update(id, { status: 'done', completedAt: new Date().toISOString() } as Partial<import('./api.js').Todo>)
    return {
      content: [{ type: 'text', text: `Completed: ${todo.title}` }],
    }
  },
)

// --- Delete Todo ---
server.tool(
  'delete_todo',
  'Permanently delete a todo',
  {
    id: z.string().describe('Todo ID'),
  },
  async ({ id }) => {
    await api.todos.delete(id)
    return {
      content: [{ type: 'text', text: `Deleted todo ${id}` }],
    }
  },
)

// --- List Projects ---
server.tool(
  'list_projects',
  'List all projects',
  {},
  async () => {
    const projects = await api.projects.list()
    if (projects.length === 0) {
      return { content: [{ type: 'text', text: 'No projects.' }] }
    }
    const lines = projects.map(p => `${p.name} | id: ${p.id}`)
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

// --- Create Project ---
server.tool(
  'create_project',
  'Create a new project (or return existing if name matches)',
  {
    name: z.string().describe('Project name'),
  },
  async ({ name }) => {
    const project = await api.projects.create(name)
    return {
      content: [{ type: 'text', text: `Project: ${project.name} | id: ${project.id}` }],
    }
  },
)

// --- Rename Project ---
server.tool(
  'rename_project',
  'Rename a project (cascades to all associated todos)',
  {
    id: z.string().describe('Project ID'),
    name: z.string().describe('New project name'),
  },
  async ({ id, name }) => {
    const project = await api.projects.rename(id, name)
    return {
      content: [{ type: 'text', text: `Renamed to: ${project.name}` }],
    }
  },
)

// --- Delete Project ---
server.tool(
  'delete_project',
  'Delete a project (removes label from todos, unlinks notes)',
  {
    id: z.string().describe('Project ID'),
  },
  async ({ id }) => {
    await api.projects.delete(id)
    return {
      content: [{ type: 'text', text: `Deleted project ${id}` }],
    }
  },
)

// --- List Habits ---
server.tool(
  'list_habits',
  'List all habits with today\'s completion status',
  {},
  async () => {
    const habits = await api.habits.list()
    const today = todayStr()
    const active = habits.filter(h => !h.archived)

    const lines = active.map(h => {
      const done = h.completions[today] ? '[x]' : '[ ]'
      return `${done} ${h.name}${h.description ? ` — ${h.description}` : ''} | id: ${h.id}`
    })

    return {
      content: [{ type: 'text', text: lines.length === 0
        ? 'No active habits.'
        : lines.join('\n')
      }],
    }
  },
)

// --- Toggle Habit ---
server.tool(
  'toggle_habit',
  'Toggle a habit\'s completion for today (or a specific date)',
  {
    id: z.string().describe('Habit ID'),
    date: z.string().optional().describe('Date string (YYYY-MM-DD), defaults to today'),
    completed: z.boolean().describe('Mark as completed (true) or uncompleted (false)'),
  },
  async ({ id, date, completed }) => {
    const dateStr = date || todayStr()
    const habit = await api.habits.toggleCompletion(id, dateStr, completed)
    const status = completed ? 'completed' : 'uncompleted'
    return {
      content: [{ type: 'text', text: `${habit.name}: ${status} for ${dateStr}` }],
    }
  },
)

// --- List Notes ---
server.tool(
  'list_notes',
  'List all notes (titles and IDs)',
  {},
  async () => {
    const notes = await api.notes.list()
    const lines = notes.map(n => `${n.title} | id: ${n.id}`)
    return {
      content: [{ type: 'text', text: lines.length === 0 ? 'No notes.' : lines.join('\n') }],
    }
  },
)

// --- Read Note ---
server.tool(
  'read_note',
  'Read the full content of a note',
  {
    id: z.string().describe('Note ID'),
  },
  async ({ id }) => {
    const note = await api.notes.get(id)
    return {
      content: [{ type: 'text', text: `# ${note.title}\n\n${note.content}` }],
    }
  },
)

// --- Create Note ---
server.tool(
  'create_note',
  'Create a new note',
  {
    title: z.string().describe('Note title'),
    content: z.string().default('').describe('Note content (Markdown)'),
  },
  async ({ title, content }) => {
    const note = await api.notes.create({ title, content })
    return {
      content: [{ type: 'text', text: `Created note: ${note.title} | id: ${note.id}` }],
    }
  },
)

// --- Update Note ---
server.tool(
  'update_note',
  'Update a note\'s title or content',
  {
    id: z.string().describe('Note ID'),
    title: z.string().optional().describe('New title'),
    content: z.string().optional().describe('New content (Markdown)'),
  },
  async ({ id, title, content }) => {
    const data: Partial<import('./api.js').Note> = {}
    if (title !== undefined) data.title = title
    if (content !== undefined) data.content = content
    const note = await api.notes.update(id, data)
    return {
      content: [{ type: 'text', text: `Updated note: ${note.title}` }],
    }
  },
)

// --- List Events ---
server.tool(
  'list_events',
  'List calendar events',
  {},
  async () => {
    const events = await api.events.list()
    const lines = events.map(e => {
      const start = e.startTime.slice(0, 16).replace('T', ' ')
      return `${start} ${e.title}${e.location ? ` @ ${e.location}` : ''} | id: ${e.id}`
    })
    return {
      content: [{ type: 'text', text: lines.length === 0 ? 'No events.' : lines.join('\n') }],
    }
  },
)

// --- Create Event ---
server.tool(
  'create_event',
  'Create a calendar event',
  {
    title: z.string().describe('Event title'),
    start_time: z.string().describe('Start time (ISO format)'),
    end_time: z.string().describe('End time (ISO format)'),
    all_day: z.boolean().default(false).describe('All-day event'),
    description: z.string().optional().describe('Description'),
    location: z.string().optional().describe('Location'),
  },
  async (input) => {
    const event = await api.events.create({
      title: input.title,
      startTime: input.start_time,
      endTime: input.end_time,
      allDay: input.all_day,
      description: input.description,
      location: input.location,
    } as Partial<import('./api.js').CalendarEvent>)
    return {
      content: [{ type: 'text', text: `Created event: ${event.title} at ${event.startTime.slice(0, 16).replace('T', ' ')}` }],
    }
  },
)

// --- List Reviews ---
server.tool(
  'list_reviews',
  'List weekly reviews',
  {},
  async () => {
    const reviews = await api.reviews.list()
    const lines = reviews.map(r => `Week ${r.id}: ${r.reflection.slice(0, 80)}${r.reflection.length > 80 ? '...' : ''}`)
    return {
      content: [{ type: 'text', text: lines.length === 0 ? 'No reviews.' : lines.join('\n') }],
    }
  },
)

// --- List Playlists ---
server.tool(
  'list_playlists',
  'List all routine playlists',
  {},
  async () => {
    const playlists = await api.playlists.list()
    if (playlists.length === 0) {
      return { content: [{ type: 'text', text: 'No playlists.' }] }
    }
    const lines = playlists.map(p => {
      const totalMin = p.items.reduce((sum, i) => sum + (i.estimatedMinutes ?? 15), 0)
      return `${p.name} (${p.items.length} tasks, ~${totalMin}m) | id: ${p.id}`
    })
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

// --- Get Playlist ---
server.tool(
  'get_playlist',
  'Get a playlist with all its items',
  {
    id: z.string().describe('Playlist ID'),
  },
  async ({ id }) => {
    const playlist = await api.playlists.get(id)
    const header = `# ${playlist.name}\n`
    const items = playlist.items.map((item, i) =>
      `${i + 1}. ${item.title}${item.estimatedMinutes ? ` (~${item.estimatedMinutes}m)` : ''}${item.project ? ` [${item.project}]` : ''}`
    )
    return { content: [{ type: 'text', text: header + items.join('\n') }] }
  },
)

// --- Create Playlist ---
server.tool(
  'create_playlist',
  'Create a new routine playlist with optional items',
  {
    name: z.string().describe('Playlist name'),
    description: z.string().optional().describe('Description'),
    items: z.array(z.object({
      title: z.string().describe('Step title'),
      estimated_minutes: z.number().optional().describe('Time estimate in minutes'),
      size: z.enum(['small', 'medium', 'large']).optional().describe('Task size'),
      energy_level: z.enum(['low', 'medium_low', 'medium', 'high']).optional().describe('Energy level'),
      project: z.string().optional().describe('Project name'),
    })).optional().describe('Playlist steps'),
  },
  async (input) => {
    const items = input.items?.map((item, i) => ({
      title: item.title,
      estimatedMinutes: item.estimated_minutes,
      size: item.size,
      energyLevel: item.energy_level,
      project: item.project,
      sortOrder: i,
    }))
    const playlist = await api.playlists.create({
      name: input.name,
      description: input.description,
      items,
    })
    return {
      content: [{ type: 'text', text: `Created playlist: ${playlist.name} (${playlist.items.length} items) | id: ${playlist.id}` }],
    }
  },
)

// --- Update Playlist ---
server.tool(
  'update_playlist',
  'Update a playlist name, description, or replace all items',
  {
    id: z.string().describe('Playlist ID'),
    name: z.string().optional().describe('New name'),
    description: z.string().optional().describe('New description'),
    items: z.array(z.object({
      title: z.string().describe('Step title'),
      estimated_minutes: z.number().optional().describe('Time estimate in minutes'),
      size: z.enum(['small', 'medium', 'large']).optional().describe('Task size'),
      energy_level: z.enum(['low', 'medium_low', 'medium', 'high']).optional().describe('Energy level'),
      project: z.string().optional().describe('Project name'),
    })).optional().describe('Replace all items with this list'),
  },
  async ({ id, ...updates }) => {
    const data: Record<string, unknown> = {}
    if (updates.name !== undefined) data.name = updates.name
    if (updates.description !== undefined) data.description = updates.description
    if (updates.items !== undefined) {
      data.items = updates.items.map((item, i) => ({
        title: item.title,
        estimatedMinutes: item.estimated_minutes,
        size: item.size,
        energyLevel: item.energy_level,
        project: item.project,
        sortOrder: i,
      }))
    }
    const playlist = await api.playlists.update(id, data as any)
    return {
      content: [{ type: 'text', text: `Updated playlist: ${playlist.name} (${playlist.items.length} items)` }],
    }
  },
)

// --- Delete Playlist ---
server.tool(
  'delete_playlist',
  'Delete a playlist',
  {
    id: z.string().describe('Playlist ID'),
  },
  async ({ id }) => {
    await api.playlists.delete(id)
    return {
      content: [{ type: 'text', text: `Deleted playlist ${id}` }],
    }
  },
)

// --- Start Playlist ---
server.tool(
  'start_playlist',
  'Start a playlist — creates today_pinned todos from all playlist items',
  {
    id: z.string().describe('Playlist ID'),
  },
  async ({ id }) => {
    const result = await api.playlists.start(id)
    return {
      content: [{ type: 'text', text: `Started playlist — created ${result.count} todos for today` }],
    }
  },
)

// --- Get Preferences ---
server.tool(
  'get_preferences',
  'Get user preferences (energy level, theme)',
  {},
  async () => {
    const prefs = await api.preferences.get()
    return {
      content: [{ type: 'text', text: JSON.stringify(prefs, null, 2) }],
    }
  },
)

// --- Set Energy Level ---
server.tool(
  'set_energy',
  'Set current energy level',
  {
    level: z.enum(['low', 'medium_low', 'medium', 'high']).describe('Energy level'),
  },
  async ({ level }) => {
    await api.preferences.update({ currentEnergy: level })
    return {
      content: [{ type: 'text', text: `Energy level set to: ${level}` }],
    }
  },
)

// ========================
// START
// ========================

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
