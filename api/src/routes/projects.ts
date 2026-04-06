import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

// List projects for authenticated user
router.get('/', async (req, res) => {
  const rows = await db.select().from(schema.projects)
    .where(eq(schema.projects.userId, req.userId!))
  res.json(rows)
})

// Create project (upsert by name)
router.post('/', async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return }

  const [existing] = await db.select().from(schema.projects)
    .where(and(eq(schema.projects.userId, req.userId!), eq(schema.projects.name, name.trim())))

  if (existing) {
    res.json(existing)
    return
  }

  const [row] = await db.insert(schema.projects)
    .values({ userId: req.userId!, name: name.trim() })
    .returning()
  res.status(201).json(row)
})

// Rename project — also updates todos.project
router.put('/:id', async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return }

  // Get old project name
  const [project] = await db.select().from(schema.projects)
    .where(and(eq(schema.projects.id, req.params.id), eq(schema.projects.userId, req.userId!)))
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  const oldName = project.name
  const newName = name.trim()

  // Update project name
  const [updated] = await db.update(schema.projects)
    .set({ name: newName, updatedAt: new Date() })
    .where(eq(schema.projects.id, req.params.id))
    .returning()

  // Cascade rename to todos.project
  await db.update(schema.todos)
    .set({ project: newName })
    .where(and(eq(schema.todos.userId, req.userId!), eq(schema.todos.project, oldName)))

  res.json(updated)
})

// Delete project — clears todos.project, join table cascades
router.delete('/:id', async (req, res) => {
  const [project] = await db.select().from(schema.projects)
    .where(and(eq(schema.projects.id, req.params.id), eq(schema.projects.userId, req.userId!)))
  if (!project) { res.status(404).json({ error: 'Not found' }); return }

  // Clear todos.project for matching todos
  await db.update(schema.todos)
    .set({ project: null })
    .where(and(eq(schema.todos.userId, req.userId!), eq(schema.todos.project, project.name)))

  // Delete project (note_projects cascade)
  await db.delete(schema.projects).where(eq(schema.projects.id, req.params.id))

  res.status(204).send()
})

export default router
