import { Router } from 'express'
import { eq, and, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

/** Resolve project names to IDs, creating any that don't exist */
async function resolveProjectIds(userId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return []

  // Find existing
  const existing = await db.select().from(schema.projects)
    .where(and(eq(schema.projects.userId, userId), inArray(schema.projects.name, names)))

  const existingMap = new Map(existing.map(p => [p.name, p.id]))
  const missing = names.filter(n => !existingMap.has(n))

  // Create missing projects
  if (missing.length > 0) {
    const created = await db.insert(schema.projects)
      .values(missing.map(name => ({ userId, name })))
      .onConflictDoNothing()
      .returning()
    for (const p of created) existingMap.set(p.name, p.id)
  }

  return names.map(n => existingMap.get(n)!).filter(Boolean)
}

/** Attach project names to notes */
async function attachProjects(notes: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  if (notes.length === 0) return notes

  const noteIds = notes.map(n => n.id as string)
  const joins = await db.select({
    noteId: schema.noteProjects.noteId,
    projectId: schema.noteProjects.projectId,
  }).from(schema.noteProjects).where(inArray(schema.noteProjects.noteId, noteIds))

  if (joins.length === 0) return notes.map(n => ({ ...n, projects: [] }))

  const projectIds = [...new Set(joins.map(j => j.projectId))]
  const projectRows = await db.select().from(schema.projects)
    .where(inArray(schema.projects.id, projectIds))
  const projectMap = new Map(projectRows.map(p => [p.id, p.name]))

  const noteProjectMap = new Map<string, string[]>()
  for (const j of joins) {
    const name = projectMap.get(j.projectId)
    if (name) {
      const list = noteProjectMap.get(j.noteId) ?? []
      list.push(name)
      noteProjectMap.set(j.noteId, list)
    }
  }

  return notes.map(n => ({
    ...n,
    projects: noteProjectMap.get(n.id as string) ?? [],
  }))
}

/** Sync note_projects join table for a note */
async function syncNoteProjects(noteId: string, userId: string, projectNames: string[]) {
  // Delete existing links
  await db.delete(schema.noteProjects).where(eq(schema.noteProjects.noteId, noteId))

  if (projectNames.length > 0) {
    const projectIds = await resolveProjectIds(userId, projectNames)
    if (projectIds.length > 0) {
      await db.insert(schema.noteProjects)
        .values(projectIds.map(projectId => ({ noteId, projectId })))
        .onConflictDoNothing()
    }
  }
}

router.get('/', async (req, res) => {
  const rows = await db.select().from(schema.notes).where(eq(schema.notes.userId, req.userId!))
  const withProjects = await attachProjects(rows as unknown as Record<string, unknown>[])
  res.json(withProjects)
})

router.get('/:id', async (req, res) => {
  const [row] = await db.select().from(schema.notes)
    .where(and(eq(schema.notes.id, req.params.id), eq(schema.notes.userId, req.userId!)))
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  const [withProjects] = await attachProjects([row as unknown as Record<string, unknown>])
  res.json(withProjects)
})

router.post('/', async (req, res) => {
  const { projects: projectNames, ...noteData } = req.body
  const [row] = await db.insert(schema.notes).values({ ...noteData, userId: req.userId! }).returning()

  if (Array.isArray(projectNames) && projectNames.length > 0) {
    await syncNoteProjects(row.id, req.userId!, projectNames)
  }

  const [withProjects] = await attachProjects([row as unknown as Record<string, unknown>])
  res.status(201).json(withProjects)
})

router.put('/:id', async (req, res) => {
  const { id, userId, createdAt, firestoreId, projects: projectNames, project: _legacyProject, ...updates } = req.body

  const [row] = await db.update(schema.notes).set(updates)
    .where(and(eq(schema.notes.id, req.params.id), eq(schema.notes.userId, req.userId!)))
    .returning()
  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  // If projects array was provided, sync the join table
  if (Array.isArray(projectNames)) {
    await syncNoteProjects(row.id, req.userId!, projectNames)
  }

  const [withProjects] = await attachProjects([row as unknown as Record<string, unknown>])
  res.json(withProjects)
})

router.delete('/:id', async (req, res) => {
  const [row] = await db.delete(schema.notes)
    .where(and(eq(schema.notes.id, req.params.id), eq(schema.notes.userId, req.userId!)))
    .returning({ id: schema.notes.id })
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.status(204).send()
})

export default router
