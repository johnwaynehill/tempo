import type { Request, Response, NextFunction } from 'express'

export type Scope = 'read' | 'write' | 'ai'

/** Map HTTP method → minimum required scope on resource routers. */
const METHOD_SCOPE: Record<string, Scope> = {
  GET: 'read',
  HEAD: 'read',
  OPTIONS: 'read',
  POST: 'write',
  PUT: 'write',
  PATCH: 'write',
  DELETE: 'write',
}

function hasScope(req: Request, required: Scope): boolean {
  const scopes = req.scopes ?? []
  if (scopes.includes('*')) return true
  if (scopes.includes(required)) return true
  // 'write' implies 'read' — a writable key can also read
  if (required === 'read' && scopes.includes('write')) return true
  return false
}

/**
 * Enforce a fixed scope on every request through this router.
 * Use for routes that don't fit the read/write split (e.g. AI proxy needs 'ai').
 */
export function requireScope(scope: Scope) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (!hasScope(req, scope)) {
      res.status(403).json({
        error: `Insufficient scope. This endpoint requires '${scope}'.`,
      })
      return
    }
    next()
  }
}

/**
 * Enforce scope based on HTTP method — `read` for GET/HEAD, `write` for everything else.
 * Use for resource routers (todos, notes, etc.).
 */
export function requireMethodScope(req: Request, res: Response, next: NextFunction) {
  const required = METHOD_SCOPE[req.method] ?? 'write'
  if (!hasScope(req, required)) {
    res.status(403).json({
      error: `Insufficient scope. This ${req.method} requires '${required}'.`,
    })
    return
  }
  next()
}

/**
 * Reject API-key auth entirely. Use on routes that manage credentials themselves
 * (e.g. /api/api-keys) to prevent privilege escalation — a 'write' key shouldn't
 * be able to mint a new 'ai' key for itself.
 */
export function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  if (req.authMethod === 'api-key') {
    res.status(403).json({
      error: 'This endpoint requires user authentication. API keys cannot manage other API keys.',
    })
    return
  }
  next()
}
