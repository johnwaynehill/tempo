import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

router.get('/', async (req, res) => {
  const rows = await db.select().from(schema.habits).where(eq(schema.habits.userId, req.userId!))
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const [row] = await db.select().from(schema.habits)
    .where(and(eq(schema.habits.id, req.params.id), eq(schema.habits.userId, req.userId!)))
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(row)
})

router.post('/', async (req, res) => {
  const [row] = await db.insert(schema.habits).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json(row)
})

router.put('/:id', async (req, res) => {
  const { id, userId, createdAt, firestoreId, ...updates } = req.body
  const [row] = await db.update(schema.habits).set(updates)
    .where(and(eq(schema.habits.id, req.params.id), eq(schema.habits.userId, req.userId!)))
    .returning()
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(row)
})

// Toggle habit completion for a specific date
router.patch('/:id/completions', async (req, res) => {
  // The date middleware auto-converts ISO strings to Date objects, but we need the raw string key
  const rawDate = req.body.date
  const date = rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : String(rawDate)
  const { completed } = req.body as { date: string; completed: boolean }
  const [habit] = await db.select().from(schema.habits)
    .where(and(eq(schema.habits.id, req.params.id), eq(schema.habits.userId, req.userId!)))

  if (!habit) { res.status(404).json({ error: 'Not found' }); return }

  const completions = (habit.completions as Record<string, boolean>) || {}
  if (completed) {
    completions[date] = true
  } else {
    delete completions[date]
  }

  const [row] = await db.update(schema.habits).set({ completions })
    .where(eq(schema.habits.id, req.params.id))
    .returning()

  res.json(row)
})

router.delete('/:id', async (req, res) => {
  const [row] = await db.delete(schema.habits)
    .where(and(eq(schema.habits.id, req.params.id), eq(schema.habits.userId, req.userId!)))
    .returning({ id: schema.habits.id })
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.status(204).send()
})

export default router
