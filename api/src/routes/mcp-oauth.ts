import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

// Get by type + key
router.get('/:type/:key', async (req, res) => {
  const [row] = await db
    .select()
    .from(schema.mcpOauthState)
    .where(and(
      eq(schema.mcpOauthState.key, req.params.key),
      eq(schema.mcpOauthState.type, req.params.type),
    ))

  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  // Skip expired tokens
  if (row.expiresAt && row.expiresAt < new Date()) {
    await db.delete(schema.mcpOauthState).where(eq(schema.mcpOauthState.key, req.params.key))
    res.status(404).json({ error: 'Expired' })
    return
  }

  res.json(row.data)
})

// Upsert
router.put('/:type/:key', async (req, res) => {
  const { data, expiresAt } = req.body as { data: unknown; expiresAt?: string }

  await db
    .insert(schema.mcpOauthState)
    .values({
      key: req.params.key,
      type: req.params.type,
      data,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .onConflictDoUpdate({
      target: schema.mcpOauthState.key,
      set: {
        data,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

  res.status(204).send()
})

// Delete
router.delete('/:type/:key', async (req, res) => {
  await db
    .delete(schema.mcpOauthState)
    .where(and(
      eq(schema.mcpOauthState.key, req.params.key),
      eq(schema.mcpOauthState.type, req.params.type),
    ))

  res.status(204).send()
})

export default router
