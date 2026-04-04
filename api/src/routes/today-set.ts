import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

// Get today set for a specific date (defaults to today)
router.get('/', async (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10)
  const [row] = await db.select().from(schema.todaySets)
    .where(and(eq(schema.todaySets.userId, req.userId!), eq(schema.todaySets.date, date)))

  res.json(row || { userId: req.userId, date, todoIds: [] })
})

// Set/update today set
router.put('/', async (req, res) => {
  const { date, todoIds } = req.body as { date: string; todoIds: string[] }
  const [row] = await db
    .insert(schema.todaySets)
    .values({ userId: req.userId!, date, todoIds })
    .onConflictDoUpdate({
      target: [schema.todaySets.userId, schema.todaySets.date],
      set: { todoIds },
    })
    .returning()

  res.json(row)
})

export default router
