import { Router } from 'express'
import { eq, and, gte, desc, ilike } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

// Log a new mood entry
router.post('/', async (req, res) => {
  const { value, note } = req.body

  if (!value || typeof value !== 'number' || value < 1 || value > 100) {
    res.status(400).json({ error: 'value must be an integer between 1 and 100' })
    return
  }

  const [entry] = await db.insert(schema.moodEntries)
    .values({
      userId: req.userId!,
      value: Math.round(value),
      note: note || null,
    })
    .returning()

  // Auto-complete any habit with "mood" in the name
  const habits = await db.select().from(schema.habits)
    .where(and(
      eq(schema.habits.userId, req.userId!),
      eq(schema.habits.archived, false),
      ilike(schema.habits.name, '%mood%'),
    ))

  const today = new Date().toISOString().slice(0, 10)
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

export default router
