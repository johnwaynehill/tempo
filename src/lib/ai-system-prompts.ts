import type { Todo, Note, Habit, CalendarEvent } from '@/types'
import { toISODateString } from '@/lib/dateUtils'
import { describeRecurrence } from '@/lib/recurrence'

// --- Context serialization ---

function serializeTodo(t: Todo): string {
  const parts = [`ID:${t.id}`, `"${t.title}"`, t.status]
  if (t.project) parts.push(`project:${t.project}`)
  if (t.energy_level) parts.push(`energy:${t.energy_level}`)
  if (t.size) parts.push(`size:${t.size}`)
  if (t.impact) parts.push(`impact:${t.impact}`)
  if (t.estimated_minutes) parts.push(`est:${t.estimated_minutes}min`)
  if (t.due_date) parts.push(`due:${toISODateString(t.due_date)}`)
  if (t.recurrence) parts.push(`recurs:${describeRecurrence(t.recurrence)}`)
  return parts.join(' | ')
}

function serializeTodos(todos: Todo[]): string {
  const active = todos.filter((t) => t.status !== 'done')
  if (active.length === 0) return 'No active todos.'

  const grouped: Record<string, Todo[]> = {}
  for (const t of active) {
    const key = t.status
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(t)
  }

  const lines: string[] = [`${active.length} active todos:`]
  for (const [status, items] of Object.entries(grouped)) {
    lines.push(`\n### ${status} (${items.length})`)
    for (const t of items) {
      lines.push(`- ${serializeTodo(t)}`)
    }
  }
  return lines.join('\n')
}

function serializeNotes(notes: Note[], includeContent = false): string {
  if (notes.length === 0) return 'No notes.'
  const lines = [`${notes.length} notes:`]
  for (const n of notes.slice(0, 30)) {
    lines.push(`- ID:${n.id} | "${n.title}" (updated ${toISODateString(n.updated_at)})`)
    if (includeContent && n.content) {
      // Include a preview (first 200 chars) so Claude knows what's in each note
      const preview = n.content.slice(0, 200).replace(/\n/g, ' ')
      lines.push(`  Preview: ${preview}${n.content.length > 200 ? '...' : ''}`)
    }
  }
  if (!includeContent) {
    lines.push('\nUse the read_note tool to see full note content when needed.')
  }
  return lines.join('\n')
}

function serializeHabits(habits: Habit[]): string {
  const active = habits.filter((h) => !h.archived)
  if (active.length === 0) return 'No active habits.'
  const today = toISODateString(new Date())
  const lines = [`${active.length} active habits:`]
  for (const h of active) {
    const done = h.completions[today] ? 'done today' : 'not done today'
    lines.push(`- "${h.name}" (${h.frequency}, ${done})`)
  }
  return lines.join('\n')
}

function serializeEvents(events: CalendarEvent[]): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endOfDay = new Date(today)
  endOfDay.setHours(23, 59, 59, 999)

  const todayEvents = events.filter(
    (e) => e.start_time >= today && e.start_time <= endOfDay,
  )
  if (todayEvents.length === 0) return 'No events today.'

  const lines = [`${todayEvents.length} events today:`]
  for (const e of todayEvents) {
    const time = e.all_day
      ? 'All day'
      : `${e.start_time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${e.end_time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    lines.push(`- "${e.title}" (${time}${e.location ? `, ${e.location}` : ''})`)
  }
  return lines.join('\n')
}

// --- System prompts ---

const BASE_PERSONA = `You are an ADHD-specialized productivity assistant embedded in Tempo, a personal productivity app. You understand executive dysfunction, dopamine-driven motivation, task paralysis, and hyperfocus. You are warm, direct, and never judgmental. You speak concisely — no walls of text. When suggesting tasks, keep them small and achievable.

You have tools to create, update, complete, pin, defer, and dismiss todos. You can also create notes, update notes, and read note content. Use them proactively when you suggest actions — don't just describe what you would do, actually do it. The user's app updates in real-time when you use tools, so they'll see changes immediately.

When asked to summarize, reflect, or capture knowledge, use create_note to write it as a Markdown note. When asked about the content of a specific note, use read_note first to see it.

Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`

export type BreakdownStyle = 'micro-steps' | 'gamify' | 'transition-protocol'

const BREAKDOWN_INSTRUCTIONS: Record<BreakdownStyle, string> = {
  'micro-steps': `The user's executive function is at zero and they're paralyzed. Break the task down into the most ridiculous, tiny, micro-steps. DO NOT give the whole list at once. Give ONE step at a time — make it so easy they can do it while still sitting on the couch. After each step, wait for them to say they did it before giving the next one. Use the create_todo tool to create each micro-step as a real todo (status: "today_pinned", size: "small", energy: "low").`,

  'gamify': `The user's brain has zero dopamine for this task and is fighting them. Give them 3 chaotic, highly stimulating ways to gamify this task or pair it with an immediate, short-term reward so their brain actually wants to start. Be creative, fun, and a little unhinged. After suggesting, use the create_todo tool to create concrete action items based on the approach they like best.`,

  'transition-protocol': `The user is stuck scrolling and cannot physically transition to doing the task. Act as their empathetic ADHD coach. Give them a 5-minute, low-energy "transition protocol" to gently shift their nervous system out of freeze mode. Do NOT tell them to "just do it." Focus on regulating their nervous system first: body movement, sensory grounding, environment shifting. Use the create_todo tool to create each step of the protocol as a tiny todo (status: "today_pinned", size: "small", energy: "low").`,
}

export interface BreakdownPromptInput {
  todo: Todo
  style: BreakdownStyle
  currentEnergy?: string
  granularity?: number
}

function granularityInstruction(granularity: number): string {
  switch (granularity) {
    case 1: return 'Break the task into 2–3 high-level phases. Keep it broad — just enough structure to see the path forward.'
    case 2: return 'Break the task into 3–5 clear steps. Moderate detail — concrete but not overly granular.'
    case 3: return 'Break the task into 5–8 concrete, actionable steps. Each step should be clearly defined and completable in a short sitting.'
    case 4: return 'Break the task into 8–12 small, specific steps. Think "what would I literally do next?" level of detail.'
    case 5: return 'Break the task into 10–15 ridiculously tiny micro-steps, each completable in under 2 minutes. Make them so small that starting feels effortless.'
    default: return 'Break the task into 5–8 concrete, actionable steps.'
  }
}

export function buildBreakdownSystemPrompt(input: BreakdownPromptInput & { todayCount: number }): string {
  const { todo, style, currentEnergy, todayCount, granularity } = input

  const granularityBlock = granularity
    ? `\n\n## Granularity Level: ${granularity}/5\n${granularityInstruction(granularity)}\nInclude a time estimate (in minutes) for each step you create.`
    : ''

  return `${BASE_PERSONA}

## Your Role
You are helping the user get unstuck on a specific task using the "${style}" approach.

## The Task
${serializeTodo(todo)}

## User Context
${currentEnergy ? `Current energy level: ${currentEnergy}` : 'Energy level not set.'}
Currently ${todayCount} items pinned to Today.

## Instructions
${BREAKDOWN_INSTRUCTIONS[style]}${granularityBlock}

## HARD LIMIT: Maximum 5 items in Today
The Today list currently has ${todayCount} items. The absolute maximum is 5 — this is an ADHD app and more than 5 causes paralysis. You can add at most ${Math.max(0, 5 - todayCount)} more items with status "today_pinned". If Today is already full (5 items), create new todos with status "backlog" instead, or suggest the user dismiss something from Today first. NEVER exceed 5 total items in Today.

Important: When you create todos with create_todo, they should inherit the project "${todo.project ?? ''}" from the parent task. Each created todo should be small, concrete, and immediately actionable.`
}

export function buildBreakdownFirstMessage(todo: Todo, style: BreakdownStyle): string {
  switch (style) {
    case 'micro-steps':
      return `I have to do "${todo.title}" but my executive function is at zero and I'm paralyzed. Break this down into the most ridiculous, tiny, micro-steps. Just give me the first step, and make it so easy I can do it while I'm still sitting on the couch.`
    case 'gamify':
      return `I need to complete "${todo.title}". My brain has zero dopamine for this and is fighting me. Give me 3 chaotic, highly stimulating ways to gamify this task or pair it with an immediate, short-term reward so my brain actually wants to start.`
    case 'transition-protocol':
      return `I am stuck scrolling and cannot physically transition to doing "${todo.title}". Act as my empathetic ADHD coach. Give me a 5-minute, low-energy transition protocol to gently shift my nervous system out of freeze mode. Do not tell me to "just do it" — focus on regulating my nervous system first.`
  }
}

export interface TodayCurationInput {
  todos: Todo[]
  notes: Note[]
  habits: Habit[]
  events: CalendarEvent[]
  currentEnergy?: string
  todayTodoIds: string[]
}

export function buildTodayCurationSystemPrompt(input: TodayCurationInput): string {
  const { todos, notes, habits, events, currentEnergy, todayTodoIds } = input

  const todayTodos = todayTodoIds
    .map((id) => todos.find((t) => t.id === id))
    .filter((t): t is Todo => t !== undefined)

  return `${BASE_PERSONA}

## Your Role
You are helping the user plan and manage their day. You have full context of their todos, habits, and calendar. Use the tools to make changes directly — create todos, pin items to today, defer things, etc.

## Current Today List (${todayTodos.length} items)
${todayTodos.length > 0 ? todayTodos.map((t) => `- ${serializeTodo(t)}`).join('\n') : 'Empty — no todos pinned for today.'}

## All Todos
${serializeTodos(todos)}

## Calendar
${serializeEvents(events)}

## Habits
${serializeHabits(habits)}

## Notes
${serializeNotes(notes, true)}

## User Context
${currentEnergy ? `Current energy level: ${currentEnergy}` : 'Energy level not set.'}

## Guidelines
- HARD RULE: The Today list must have NO MORE THAN 5 items total. This is an ADHD app — too many tasks causes paralysis. Count what's already pinned before adding more.
- When planning the day, aim for 3-5 total tasks. If there are already 5 pinned, do NOT add more — suggest swaps instead (dismiss one, pin another).
- Match tasks to the user's current energy level. Low energy = small/low-energy tasks. High energy = tackle the big stuff.
- Pin tasks to today with pin_to_today. Create new tasks with create_todo only if the user asks for something new.
- Be opinionated but flexible. If they push back, adjust immediately.
- Keep responses short and actionable. This is a productivity tool, not a therapy session.
- If you notice overdue tasks or neglected projects, gently flag them.
- When creating or suggesting tasks, include a time estimate (estimated_minutes) to help with time blindness. Use realistic estimates — most tasks take longer than you think.`
}
