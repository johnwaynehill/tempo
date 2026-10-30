import { Router } from 'express'
import { eq, and, gte, desc, ilike } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// The body-date middleware in index.ts has already turned ISO strings into Dates (a bare
// yyyy-MM-dd becomes local midnight), so these accept either form.
function toDay(v: unknown): string | null {
  if (typeof v === 'string') return DATE_RE.test(v) ? v : null
  if (v instanceof Date && !isNaN(v.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  }
  return null
}

function toInstant(v: unknown): Date | null {
  const d = v instanceof Date ? v : typeof v === 'string' ? new Date(v) : null
  return d && !isNaN(d.getTime()) ? d : null
}

// Log a new mood entry. Optional fields let an offline client replay a check-in faithfully:
// `id` makes a retried POST idempotent (same user gets the existing entry back, another user's
// id is a 409), `createdAt` keeps when it was logged (never in the future), and `date` is the
// client's local yyyy-MM-dd for the mood-habit check-off (the server's UTC date is wrong in
// the evening for anyone west of Greenwich).
router.post('/', async (req, res) => {
  const { value, note, id, createdAt, date } = req.body

  if (!value || typeof value !== 'number' || value < 1 || value > 100) {
    res.status(400).json({ error: 'value must be an integer between 1 and 100' })
    return
  }
  if (id !== undefined && (typeof id !== 'string' || !UUID_RE.test(id))) {
    res.status(400).json({ error: 'id must be a UUID' })
    return
  }
  const day = date === undefined ? null : toDay(date)
  if (date !== undefined && !day) {
    res.status(400).json({ error: 'date must be yyyy-MM-dd' })
    return
  }
  let loggedAt: Date | undefined
  if (createdAt !== undefined) {
    const parsed = toInstant(createdAt)
    if (!parsed) {
      res.status(400).json({ error: 'createdAt must be an ISO date' })
      return
    }
    loggedAt = parsed > new Date() ? new Date() : parsed
  }

  const [entry] = await db.insert(schema.moodEntries)
    .values({
      ...(id ? { id } : {}),
      userId: req.userId!,
      value: Math.round(value),
      note: note || null,
      ...(loggedAt ? { createdAt: loggedAt } : {}),
    })
    .onConflictDoNothing({ target: schema.moodEntries.id })
    .returning()

  if (!entry) {
    const [existing] = await db.select().from(schema.moodEntries).where(eq(schema.moodEntries.id, id))
    if (existing && existing.userId === req.userId) { res.status(200).json(existing); return }
    res.status(409).json({ error: 'A mood entry with that id already exists' })
    return
  }

  // Auto-complete any habit with "mood" in the name
  const habits = await db.select().from(schema.habits)
    .where(and(
      eq(schema.habits.userId, req.userId!),
      eq(schema.habits.archived, false),
      ilike(schema.habits.name, '%mood%'),
    ))

  const today = day ?? new Date().toISOString().slice(0, 10)
  for (const habit of habits) {
    const completions = (habit.completions as Record<string, boolean>) || {}
    if (!completions[today]) {
      completions[today] = true
      await db.update(schema.habits)
        .set({ completions, updatedAt: new Date() })
        .where(eq(schema.habits.id, habit.id))
    }
  }

  res.status(201).json(entry)
})

// Get mood history
router.get('/', async (req, res) => {
  const days = parseInt(req.query.days as string) || 7
  const since = new Date()
  since.setDate(since.getDate() - days)

  const entries = await db.select().from(schema.moodEntries)
    .where(and(
      eq(schema.moodEntries.userId, req.userId!),
      gte(schema.moodEntries.createdAt, since),
    ))
    .orderBy(desc(schema.moodEntries.createdAt))
    .limit(100)

  res.json(entries)
})

// Get latest mood entry
router.get('/latest', async (req, res) => {
  const [entry] = await db.select().from(schema.moodEntries)
    .where(eq(schema.moodEntries.userId, req.userId!))
    .orderBy(desc(schema.moodEntries.createdAt))
    .limit(1)

  res.json(entry || null)
})

// Delete a mood entry. A habit the check-in ticked off stays ticked: it may have been ticked by
// hand or by another check-in that day, and it's one tap to undo.
router.delete('/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) { res.status(404).json({ error: 'Not found' }); return }
  const [row] = await db.delete(schema.moodEntries)
    .where(and(eq(schema.moodEntries.id, req.params.id), eq(schema.moodEntries.userId, req.userId!)))
    .returning({ id: schema.moodEntries.id })
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.status(204).send()
})

export default router
