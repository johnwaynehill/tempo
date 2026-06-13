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
  // `source`/`externalId`/`etag` are owned by the Google sync — never let a
  // client forge a mirrored event. New events are always native ('tempo').
  const { source, externalId, etag, ...rest } = req.body
  const [row] = await db.insert(schema.calendarEvents)
    .values({ ...rest, userId: req.userId!, source: 'tempo' }).returning()
  res.status(201).json(row)
})

router.put('/:id', async (req, res) => {
  const [existing] = await db.select({ source: schema.calendarEvents.source })
    .from(schema.calendarEvents)
    .where(and(eq(schema.calendarEvents.id, req.params.id), eq(schema.calendarEvents.userId, req.userId!)))
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.source === 'google') {
    res.status(403).json({ error: 'Google Calendar events are read-only in Tempo' }); return
  }
  const { id, userId, createdAt, firestoreId, source, externalId, etag, ...updates } = req.body
  const [row] = await db.update(schema.calendarEvents).set(updates)
    .where(and(eq(schema.calendarEvents.id, req.params.id), eq(schema.calendarEvents.userId, req.userId!)))
    .returning()
  res.json(row)
})

router.delete('/:id', async (req, res) => {
  const [existing] = await db.select({ source: schema.calendarEvents.source })
    .from(schema.calendarEvents)
    .where(and(eq(schema.calendarEvents.id, req.params.id), eq(schema.calendarEvents.userId, req.userId!)))
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  if (existing.source === 'google') {
    res.status(403).json({ error: 'Google Calendar events are read-only in Tempo; disconnect to remove them' }); return
  }
  await db.delete(schema.calendarEvents)
    .where(and(eq(schema.calendarEvents.id, req.params.id), eq(schema.calendarEvents.userId, req.userId!)))
  res.status(204).send()
})

export default router
