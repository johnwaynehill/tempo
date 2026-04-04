import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

router.get('/', async (req, res) => {
  const rows = await db.select().from(schema.calendarEvents)
    .where(eq(schema.calendarEvents.userId, req.userId!))
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const [row] = await db.select().from(schema.calendarEvents)
    .where(and(eq(schema.calendarEvents.id, req.params.id), eq(schema.calendarEvents.userId, req.userId!)))
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(row)
})

router.post('/', async (req, res) => {
  const [row] = await db.insert(schema.calendarEvents)
    .values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json(row)
})

router.put('/:id', async (req, res) => {
  const { id, userId, createdAt, firestoreId, ...updates } = req.body
  const [row] = await db.update(schema.calendarEvents).set(updates)
    .where(and(eq(schema.calendarEvents.id, req.params.id), eq(schema.calendarEvents.userId, req.userId!)))
    .returning()
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(row)
})

router.delete('/:id', async (req, res) => {
  const [row] = await db.delete(schema.calendarEvents)
    .where(and(eq(schema.calendarEvents.id, req.params.id), eq(schema.calendarEvents.userId, req.userId!)))
    .returning({ id: schema.calendarEvents.id })
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.status(204).send()
})

export default router
