import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { runAutoplanForAllOptedIn, runAutoplanForUser } from '../lib/autoplan.js'

const router = Router()

/**
 * Shared-secret guard for the autoplan cron endpoint.
 *
 * Cron runs without a Firebase user, so we can't use the normal auth chain.
 * Instead the cron sends `X-Autoplan-Secret: <secret>` matching the
 * `AUTOPLAN_SECRET` env var. If unset in env, the endpoint is disabled
 * (returns 503) — safer than defaulting to open.
 */
function requireAutoplanSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.AUTOPLAN_SECRET
  if (!expected) {
    res.status(503).json({ error: 'Autoplan disabled: AUTOPLAN_SECRET not configured' })
    return
  }
  const provided = req.headers['x-autoplan-secret']
  if (typeof provided !== 'string' || provided !== expected) {
    res.status(401).json({ error: 'Invalid or missing X-Autoplan-Secret header' })
    return
  }
  next()
}

/**
 * POST /api/internal/autoplan
 *
 * Iterates over every user with `autoplan_enabled = true` and picks 3–5 todos
 * for their Today view (replacing whatever was there). Idempotent: a second
 * call on the same day for the same user is a no-op unless `?force=1`.
 *
 * Optional body params:
 *   { userId?: string }   — run only for a single user (testing)
 *   { force?: boolean }   — bypass the per-day idempotency check
 *
 * Or query param `?force=1` for the same effect.
 *
 * Returns a JSON summary of what happened per user. Errors on individual
 * users do NOT abort the batch.
 */
router.post('/', requireAutoplanSecret, async (req: Request, res: Response) => {
  const force = req.query.force === '1' || req.body?.force === true
  const targetUserId = typeof req.body?.userId === 'string' ? req.body.userId : null

  try {
    if (targetUserId) {
      // Single-user mode (for testing / manual trigger). We still respect
      // the user's stored timezone preference, defaulting to LA if unset.
      const tz = typeof req.body?.timezone === 'string'
        ? req.body.timezone
        : 'America/Los_Angeles'
      const result = await runAutoplanForUser(targetUserId, tz, { force })
      res.json({ ok: true, count: 1, results: [result] })
      return
    }

    const results = await runAutoplanForAllOptedIn({ force })
    res.json({ ok: true, count: results.length, results })
  } catch (err) {
    console.error('[autoplan] batch failed:', err)
    res.status(500).json({
      error: 'Autoplan batch failed',
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

export default router
