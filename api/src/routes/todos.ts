import { Router } from 'express'
import { eq, and, gte } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getNextOccurrence, isRecurrenceRule } from '../lib/recurrence.js'
import { userTimezone } from '../lib/ai-usage.js'

const TODO_STATUSES = new Set(['inbox', 'today_pinned', 'backlog', 'deferred', 'done'])
type TodoStatus = 'inbox' | 'today_pinned' | 'backlog' | 'deferred' | 'done'

const router = Router()

// List todos for authenticated user.
// Optional filters: ?status=<todo_status> and ?since=<ISO timestamp> (updated_at >= since),
// so a phone can sync deltas instead of downloading everything on every launch.
router.get('/', async (req, res) => {
  const conditions = [eq(schema.todos.userId, req.userId!)]

  const status = req.query.status
  if (typeof status === 'string') {
    if (!TODO_STATUSES.has(status)) { res.status(400).json({ error: `Unknown status "${status}"` }); return }
    conditions.push(eq(schema.todos.status, status as TodoStatus))
  }

  const since = req.query.since
  if (typeof since === 'string') {
    const d = new Date(since)
    if (Number.isNaN(d.getTime())) { res.status(400).json({ error: 'since must be an ISO-8601 timestamp' }); return }
    conditions.push(gte(schema.todos.updatedAt, d))
  }

  const rows = await db
    .select()
    .from(schema.todos)
    .where(and(...conditions))

  res.json(rows)
})

// Get single todo
router.get('/:id', async (req, res) => {
  const [row] = await db
    .select()
    .from(schema.todos)
    .where(and(eq(schema.todos.id, req.params.id), eq(schema.todos.userId, req.userId!)))

  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(row)
})

// Create todo. Idempotent on client-supplied ids: a client (web, iOS, the share
// extension, MCP) may retry a create whose response it never saw, and the iOS sync
// queue replays writes in order, so a 500 on a repeated id would park every later
// offline write behind it. A repeat from the same user gets the existing row (200);
// an id that belongs to someone else is a conflict (409).
router.post('/', async (req, res) => {
  const [row] = await db
    .insert(schema.todos)
    .values({ ...req.body, userId: req.userId! })
    .onConflictDoNothing({ target: schema.todos.id })
    .returning()

  if (row) { res.status(201).json(row); return }

  const id = (req.body as { id?: unknown } | undefined)?.id
  if (typeof id === 'string') {
    const [existing] = await db.select().from(schema.todos).where(eq(schema.todos.id, id))
    if (existing && existing.userId === req.userId) { res.status(200).json(existing); return }
  }
  res.status(409).json({ error: 'A todo with that id already exists' })
})

// Update todo
router.put('/:id', async (req, res) => {
  const { id, userId, createdAt, firestoreId, ...updates } = req.body
  const [row] = await db
    .update(schema.todos)
    .set(updates)
    .where(and(eq(schema.todos.id, req.params.id), eq(schema.todos.userId, req.userId!)))
    .returning()

  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(row)
})

// Complete a todo. Body: { actualMinutes?: number } (total timed minutes, from the
// timer). Sets status/completed_at and, for a recurring todo, creates the next
// occurrence — which used to happen only in the web client, so completions from
// the MCP server never recurred. Idempotent: completing a done todo returns it.
router.post('/:id/complete', async (req, res) => {
  const [todo] = await db
    .select()
    .from(schema.todos)
    .where(and(eq(schema.todos.id, req.params.id), eq(schema.todos.userId, req.userId!)))
  if (!todo) { res.status(404).json({ error: 'Not found' }); return }
  if (todo.status === 'done') { res.json({ todo, nextOccurrence: null }); return }

  const actualMinutes = (req.body as { actualMinutes?: unknown } | undefined)?.actualMinutes
  const updates: Partial<typeof schema.todos.$inferInsert> = { status: 'done', completedAt: new Date(), updatedAt: new Date() }
  if (typeof actualMinutes === 'number' && Number.isFinite(actualMinutes) && actualMinutes > 0) {
    updates.actualMinutes = Math.round(actualMinutes)
  }

  const [done] = await db
    .update(schema.todos)
    .set(updates)
    .where(and(eq(schema.todos.id, todo.id), eq(schema.todos.userId, req.userId!)))
    .returning()

  let nextOccurrence: typeof schema.todos.$inferSelect | null = null
  if (isRecurrenceRule(todo.recurrence)) {
    const timezone = await userTimezone(req.userId!)
    const dueDate = getNextOccurrence(todo.recurrence, todo.dueDate ?? new Date(), timezone)
    const [next] = await db
      .insert(schema.todos)
      .values({
        userId: req.userId!,
        title: todo.title,
        status: 'backlog',
        project: todo.project,
        size: todo.size,
        impact: todo.impact,
        energyLevel: todo.energyLevel,
        estimatedMinutes: todo.estimatedMinutes,
        dueDate,
        recurrence: todo.recurrence,
        recurrenceParentId: todo.recurrenceParentId ?? todo.id,
        noteId: todo.noteId,
        supports: todo.supports,
      })
      .returning()
    nextOccurrence = next
  }

  res.json({ todo: done, nextOccurrence })
})

// Delete todo
router.delete('/:id', async (req, res) => {
  const [row] = await db
    .delete(schema.todos)
    .where(and(eq(schema.todos.id, req.params.id), eq(schema.todos.userId, req.userId!)))
    .returning({ id: schema.todos.id })

  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.status(204).send()
})

export default router
