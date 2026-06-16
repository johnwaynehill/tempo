import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { syncAllEnabledUsers, syncGoogleCalendarForUser } from '../lib/google-calendar.js'

const router = Router()

/**
 * Shared-secret guard for the Google Calendar sync cron endpoint.
 *
 * The cron runs without a Firebase user, so we can't use the normal auth chain.
 * Instead it sends `X-Google-Sync-Secret: <secret>` matching the
 * `GOOGLE_SYNC_SECRET` env var. If unset, the endpoint is disabled (503) —
 * safer than defaulting to open.
 */
function requireGoogleSyncSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.GOOGLE_SYNC_SECRET
  if (!expected) {
    res.status(503).json({ error: 'Google sync disabled: GOOGLE_SYNC_SECRET not configured' })
    return
  }
  const provided = req.headers['x-google-sync-secret']
  if (typeof provided !== 'string' || provided !== expected) {
    res.status(401).json({ error: 'Invalid or missing X-Google-Sync-Secret header' })
    return
  }
  next()
}

/**
 * POST /api/internal/google-sync
 *
 * Syncs the primary Google calendar for every connection with
 * `sync_enabled = true`. Per-user errors are surfaced in the result list
 * without aborting the batch.
 *
 * Optional body param:
 *   { userId?: string }  — sync only a single user (testing / manual trigger)
 *
 * Returns a JSON summary of what happened per user.
 */
router.post('/', requireGoogleSyncSecret, async (req: Request, res: Response) => {
  const targetUserId = typeof req.body?.userId === 'string' ? req.body.userId : null

  try {
    if (targetUserId) {
      const result = await syncGoogleCalendarForUser(targetUserId)
      res.json({ ok: true, count: 1, results: [result] })
      return
    }

    const results = await syncAllEnabledUsers()
    res.json({ ok: true, count: results.length, results })
  } catch (err) {
    console.error('[google-sync] batch failed:', err)
    res.status(500).json({
      error: 'Google sync batch failed',
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

export default router
