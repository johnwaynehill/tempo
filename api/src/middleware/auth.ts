import type { Request, Response, NextFunction } from 'express'
import { createHash } from 'crypto'
import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'

// Extend Express Request with userId
declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

// Firebase ID token verification (lightweight — no Admin SDK needed)
// Validates the token against Google's public keys via the tokeninfo endpoint
// For production, consider using firebase-admin's verifyIdToken for offline verification
async function verifyFirebaseToken(idToken: string): Promise<string | null> {
  try {
    // Use firebase-admin for robust verification
    const admin = await import('firebase-admin')
    const decoded = await admin.default.auth().verifyIdToken(idToken)
    return decoded.uid
  } catch {
    return null
  }
}

// API key verification: look up SHA-256 hash in api_keys table
async function verifyApiKey(key: string): Promise<string | null> {
  const hash = createHash('sha256').update(key).digest('hex')
  const result = await db
    .select({ userId: schema.apiKeys.userId, id: schema.apiKeys.id })
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

  return result[0].userId
}

const DEV_USER_ID = 'dev-test-user'
const DEV_TOKEN = 'dev-token'

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  // Dev auth bypass — only in development
  if (process.env.NODE_ENV !== 'production') {
    const authHeader = req.headers.authorization
    if (authHeader === `Bearer ${DEV_TOKEN}`) {
      req.userId = DEV_USER_ID
      return next()
    }
  }

  // Try API key first (X-API-Key header)
  const apiKey = req.headers['x-api-key']
  if (typeof apiKey === 'string' && apiKey.startsWith('tempo_')) {
    const userId = await verifyApiKey(apiKey)
    if (userId) {
      req.userId = userId
      return next()
    }
    res.status(401).json({ error: 'Invalid API key' })
    return
  }

  // Try Firebase ID token (Authorization: Bearer <token>)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const userId = await verifyFirebaseToken(token)
    if (userId) {
      req.userId = userId
      return next()
    }
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  res.status(401).json({ error: 'Missing authentication. Use Authorization: Bearer <token> or X-API-Key header.' })
}
