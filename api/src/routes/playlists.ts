import { Router } from 'express'
import { eq, and, asc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db, schema } from '../db/index.js'

const router = Router()

// List all playlists with items
router.get('/', async (req, res) => {
  const rows = await db.select().from(schema.playlists)
    .where(eq(schema.playlists.userId, req.userId!))
    .orderBy(asc(schema.playlists.name))

  // Fetch items for all playlists
  const playlistIds = rows.map((r) => r.id)
  const allItems = playlistIds.length > 0
    ? await db.select().from(schema.playlistItems)
        .where(eq(schema.playlistItems.playlistId, rows[0]?.id ?? ''))
        .orderBy(asc(schema.playlistItems.sortOrder))
    : []

  // Actually fetch all items for all playlists
  const itemsByPlaylist: Record<string, typeof allItems> = {}
  for (const row of rows) {
    const items = await db.select().from(schema.playlistItems)
      .where(eq(schema.playlistItems.playlistId, row.id))
      .orderBy(asc(schema.playlistItems.sortOrder))
    itemsByPlaylist[row.id] = items
  }

  const result = rows.map((r) => ({
    ...r,
    items: itemsByPlaylist[r.id] ?? [],
  }))

  res.json(result)
})

// Get single playlist with items
router.get('/:id', async (req, res) => {
  const [row] = await db.select().from(schema.playlists)
    .where(and(eq(schema.playlists.id, req.params.id), eq(schema.playlists.userId, req.userId!)))
  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  const items = await db.select().from(schema.playlistItems)
    .where(eq(schema.playlistItems.playlistId, row.id))
    .orderBy(asc(schema.playlistItems.sortOrder))

  res.json({ ...row, items })
})

// Create playlist
router.post('/', async (req, res) => {
  const { items, ...playlistData } = req.body
  const [row] = await db.insert(schema.playlists)
    .values({ ...playlistData, userId: req.userId! })
    .returning()

  // Insert items if provided
  if (items && Array.isArray(items) && items.length > 0) {
    await db.insert(schema.playlistItems).values(
      items.map((item: any, i: number) => ({
        ...item,
        playlistId: row.id,
        sortOrder: item.sortOrder ?? i,
      })),
    )
  }

  const createdItems = await db.select().from(schema.playlistItems)
    .where(eq(schema.playlistItems.playlistId, row.id))
    .orderBy(asc(schema.playlistItems.sortOrder))

  res.status(201).json({ ...row, items: createdItems })
})

// Update playlist (full replace of items)
router.put('/:id', async (req, res) => {
  const { items, id, userId, createdAt, ...updates } = req.body

  const [row] = await db.update(schema.playlists)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(schema.playlists.id, req.params.id), eq(schema.playlists.userId, req.userId!)))
    .returning()

  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  // Replace items
  if (items && Array.isArray(items)) {
    await db.delete(schema.playlistItems)
      .where(eq(schema.playlistItems.playlistId, row.id))

    if (items.length > 0) {
      await db.insert(schema.playlistItems).values(
        items.map((item: any, i: number) => ({
          title: item.title,
          size: item.size || null,
          energyLevel: item.energyLevel || null,
          estimatedMinutes: item.estimatedMinutes || null,
          project: item.project || null,
          playlistId: row.id,
          sortOrder: item.sortOrder ?? i,
        })),
      )
    }
  }

  const updatedItems = await db.select().from(schema.playlistItems)
    .where(eq(schema.playlistItems.playlistId, row.id))
    .orderBy(asc(schema.playlistItems.sortOrder))

  res.json({ ...row, items: updatedItems })
})

// Delete playlist
router.delete('/:id', async (req, res) => {
  const [row] = await db.delete(schema.playlists)
    .where(and(eq(schema.playlists.id, req.params.id), eq(schema.playlists.userId, req.userId!)))
    .returning({ id: schema.playlists.id })
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.status(204).send()
})

// Start playlist — creates todos from items
router.post('/:id/start', async (req, res) => {
  const [playlist] = await db.select().from(schema.playlists)
    .where(and(eq(schema.playlists.id, req.params.id), eq(schema.playlists.userId, req.userId!)))
  if (!playlist) { res.status(404).json({ error: 'Not found' }); return }

  const items = await db.select().from(schema.playlistItems)
    .where(eq(schema.playlistItems.playlistId, playlist.id))
    .orderBy(asc(schema.playlistItems.sortOrder))

  const todoIds: string[] = []
  for (const item of items) {
    const id = randomUUID()
    await db.insert(schema.todos).values({
      id,
      userId: req.userId!,
      title: item.title,
      status: 'today_pinned',
      size: item.size,
      energyLevel: item.energyLevel,
      estimatedMinutes: item.estimatedMinutes,
      project: item.project,
    })
    todoIds.push(id)
  }

  res.json({ todoIds, count: todoIds.length })
})

export default router
