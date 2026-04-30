import { Router } from 'express'
import { randomBytes, createHash } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const router = Router()

const VALID_SCOPES = new Set(['read', 'write', 'ai'])

/** Validate and normalize a scope array from a request body. */
function normalizeScopes(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null
  const cleaned = input
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => VALID_SCOPES.has(s))
  if (cleaned.length === 0) return null
  return Array.from(new Set(cleaned))
}

// List API keys (without hashes)
router.get('/', async (req, res) => {
  const rows = await db
    .select({
      id: schema.apiKeys.id,
      keyPrefix: schema.apiKeys.keyPrefix,
      name: schema.apiKeys.name,
      scopes: schema.apiKeys.scopes,
      createdAt: schema.apiKeys.createdAt,
      lastUsedAt: schema.apiKeys.lastUsedAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.userId, req.userId!))

  res.json(rows)
})

// Create a new API key — returns the full key ONCE
router.post('/', async (req, res) => {
  const { name, scopes: scopesInput } = req.body as { name?: string; scopes?: unknown }
  const uid = req.userId!

  // Default new keys to ['read'] — least-privilege. Caller must opt into write/ai.
  const scopes = normalizeScopes(scopesInput) ?? ['read']

  // Generate key: tempo_{uid-prefix}_{random}
  const random = randomBytes(24).toString('base64url')
  const key = `tempo_${uid.slice(0, 8)}_${random}`
  const keyHash = createHash('sha256').update(key).digest('hex')
  const keyPrefix = key.slice(0, 20) + '...'

  const [row] = await db
    .insert(schema.apiKeys)
    .values({ userId: uid, keyHash, keyPrefix, name: name || 'Default', scopes })
    .returning()

  // Return the full key only on creation
  res.status(201).json({
    id: row.id,
    key,
    keyPrefix,
    name: row.name,
    scopes: row.scopes,
    createdAt: row.createdAt,
  })
})

// Delete an API key
router.delete('/:id', async (req, res) => {
  const [row] = await db
    .delete(schema.apiKeys)
    .where(and(eq(schema.apiKeys.id, req.params.id), eq(schema.apiKeys.userId, req.userId!)))
    .returning({ id: schema.apiKeys.id })

  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.status(204).send()
})

export default router
