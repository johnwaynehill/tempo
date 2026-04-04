import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

router.get('/', async (req, res) => {
  const rows = await db.select().from(schema.weeklyReviews)
    .where(eq(schema.weeklyReviews.userId, req.userId!))
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const [row] = await db.select().from(schema.weeklyReviews)
    .where(and(eq(schema.weeklyReviews.id, req.params.id), eq(schema.weeklyReviews.userId, req.userId!)))
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(row)
})

router.put('/:id', async (req, res) => {
  const { reflection } = req.body as { reflection: string }
  const [row] = await db
    .insert(schema.weeklyReviews)
    .values({ id: req.params.id, userId: req.userId!, reflection })
    .onConflictDoUpdate({
      target: [schema.weeklyReviews.userId, schema.weeklyReviews.id],
      set: { reflection },
    })
    .returning()

  res.json(row)
})

export default router
