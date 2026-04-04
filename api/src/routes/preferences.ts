import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

router.get('/', async (req, res) => {
  const [row] = await db.select().from(schema.userPreferences)
    .where(eq(schema.userPreferences.userId, req.userId!))

  if (!row) {
    // Return defaults if no preferences exist
    res.json({ userId: req.userId, theme: 'system', notificationsEnabled: false })
    return
  }
  res.json(row)
})

router.put('/', async (req, res) => {
  const { userId, ...updates } = req.body
  const [row] = await db
    .insert(schema.userPreferences)
    .values({ ...updates, userId: req.userId! })
    .onConflictDoUpdate({
      target: schema.userPreferences.userId,
      set: updates,
    })
    .returning()

  res.json(row)
})

export default router
