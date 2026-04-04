import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

// List todos for authenticated user
router.get('/', async (req, res) => {
  const rows = await db
    .select()
    .from(schema.todos)
    .where(eq(schema.todos.userId, req.userId!))

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

// Create todo
router.post('/', async (req, res) => {
  const [row] = await db
    .insert(schema.todos)
    .values({ ...req.body, userId: req.userId! })
    .returning()

  res.status(201).json(row)
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
