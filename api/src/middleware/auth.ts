import type { Request, Response, NextFunction } from 'express'
import { createHash } from 'crypto'
import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'

// Extend Express Request with auth fields
declare global {
  namespace Express {
    interface Request {
      userId?: string
      // 'firebase' = Firebase ID token (browser/native frontend, full trust)
      // 'api-key'  = X-API-Key (third-party tools, MCP, scripts — scope-checked)
      // 'dev'      = DEV_AUTH_TOKEN (local development only)
      authMethod?: 'firebase' | 'api-key' | 'dev'
      // Effective scopes for this request. '*' means unrestricted (Firebase / dev / legacy keys).
      scopes?: string[]
    }
  }
}

// Legacy keys (created before scoping landed) get full access for back-compat.
const LEGACY_SCOPES = ['read', 'write', 'ai']

// Firebase ID token verification via firebase-admin
async function verifyFirebaseToken(idToken: string): Promise<string | null> {
  try {
    const admin = await import('firebase-admin')
    const decoded = await admin.default.auth().verifyIdToken(idToken)
    return decoded.uid
  } catch {
    return null
  }
}

// API key verification: look up SHA-256 hash, return both userId and effective scopes.
async function verifyApiKey(key: string): Promise<{ userId: string; scopes: string[] } | null> {
  const hash = createHash('sha256').update(key).digest('hex')
  const result = await db
    .select({
      userId: schema.apiKeys.userId,
      id: schema.apiKeys.id,
      scopes: schema.apiKeys.scopes,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.keyHash, hash))
    .limit(1)

  if (result.length === 0) return null

  // Update last_used_at (fire-and-forget)
  db.update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, result[0].id))
    .then(() => {})
    .catch(() => {})

  // Expand 'legacy' scope to full access for back-compat with pre-scoping keys.
  const rawScopes = result[0].scopes ?? []
  const scopes = rawScopes.includes('legacy')
    ? Array.from(new Set([...rawScopes, ...LEGACY_SCOPES]))
    : rawScopes

  return { userId: result[0].userId, scopes }
}

const DEV_USER_ID = 'dev-test-user'

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  // Dev auth bypass — must be explicitly opted-in via env var
  const devToken = process.env.DEV_AUTH_TOKEN
  if (devToken) {
    const authHeader = req.headers.authorization
    if (authHeader === `Bearer ${devToken}`) {
      req.userId = DEV_USER_ID
      req.authMethod = 'dev'
      req.scopes = ['*']
      return next()
    }
  }

  // Try API key first (X-API-Key header)
  const apiKey = req.headers['x-api-key']
  if (typeof apiKey === 'string' && apiKey.startsWith('tempo_')) {
    const result = await verifyApiKey(apiKey)
    if (result) {
      req.userId = result.userId
      req.authMethod = 'api-key'
      req.scopes = result.scopes
      return next()
    }
    res.status(401).json({ error: 'Invalid API key' })
    return
  }

  // Try Firebase ID token (Authorization: Bearer <token>) — frontend has full access
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const userId = await verifyFirebaseToken(token)
    if (userId) {
      req.userId = userId
      req.authMethod = 'firebase'
      req.scopes = ['*']
      return next()
    }
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  res.status(401).json({ error: 'Missing authentication. Use Authorization: Bearer <token> or X-API-Key header.' })
}
