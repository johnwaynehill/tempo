import { Router } from 'express'
import { eq, and, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

// List recent conversations (limit 20, newest first)
router.get('/', async (req, res) => {
  const rows = await db.select().from(schema.conversations)
    .where(eq(schema.conversations.userId, req.userId!))
    .orderBy(desc(schema.conversations.updatedAt))
    .limit(20)
  res.json(rows)
})

// Get a single conversation
router.get('/:id', async (req, res) => {
  const [row] = await db.select().from(schema.conversations)
    .where(and(
      eq(schema.conversations.id, req.params.id),
      eq(schema.conversations.userId, req.userId!),
    ))
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(row)
})

// Create or update a conversation (upsert)
router.put('/:id', async (req, res) => {
  const { mode, todoId, style, title, displayMessages, apiMessages } = req.body
  const [row] = await db
    .insert(schema.conversations)
    .values({
      id: req.params.id,
      userId: req.userId!,
      mode,
      todoId: todoId || null,
      style: style || null,
      title,
      displayMessages: displayMessages || [],
      apiMessages: apiMessages || [],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.conversations.id,
      set: {
        mode,
        todoId: todoId || null,
        style: style || null,
        title,
        displayMessages: displayMessages || [],
        apiMessages: apiMessages || [],
        updatedAt: new Date(),
      },
    })
    .returning()

  res.json(row)
})

// Delete a conversation
router.delete('/:id', async (req, res) => {
  await db.delete(schema.conversations)
    .where(and(
      eq(schema.conversations.id, req.params.id),
      eq(schema.conversations.userId, req.userId!),
    ))
  res.status(204).end()
})

export default router
