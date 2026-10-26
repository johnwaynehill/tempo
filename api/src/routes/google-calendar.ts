/**
 * Google Calendar integration — OAuth connect/disconnect + status.
 *
 * A user can connect several Google accounts; each is its own connection row
 * and is synced separately (see lib/google-calendar.ts).
 *
 * Routing note: the authenticated endpoints (`/status`, `/connect`, DELETE `/`)
 * live under the normal `/api` auth chain. The OAuth `callback` cannot — Google
 * redirects the browser there with no Authorization header — so it is exported
 * separately and mounted BEFORE the auth chain in `index.ts`. The one-time
 * `state` value ties that anonymous callback back to the user who started it.
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { randomBytes } from 'crypto'
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { encrypt, decrypt, isEncryptionConfigured } from '../lib/crypto.js'
import {
  buildAuthUrl,
  exchangeCode,
  fetchUserEmail,
  revokeToken,
  isGoogleOAuthConfigured,
} from '../lib/google-oauth.js'
import { syncGoogleCalendarForUser } from '../lib/google-calendar.js'

const STATE_TYPE = 'google_oauth_state'
const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function appUrl(): string {
  return process.env.APP_URL || 'https://tempo.designbyjohnwayne.com'
}

/** The integration needs both OAuth creds and an encryption key to be usable. */
function integrationReady(res: Response): boolean {
  if (!isGoogleOAuthConfigured() || !isEncryptionConfigured()) {
    res.status(503).json({ error: 'Google Calendar integration is not configured' })
    return false
  }
  return true
}

// --- Authenticated endpoints (mounted under the /api auth chain) ---

const router = Router()

/**
 * GET /api/google-calendar/status — connection state for the Settings UI.
 * `accounts` lists every connected Google account, oldest first. The top-level
 * `email` / `syncEnabled` / `lastSyncedAt` / `lastSyncError` describe the first
 * account, for clients built before several accounts were possible.
 */
router.get('/status', async (req: Request, res: Response) => {
  const conns = await db.select().from(schema.googleCalendarConnections)
    .where(eq(schema.googleCalendarConnections.userId, req.userId!))
    .orderBy(asc(schema.googleCalendarConnections.createdAt))
  if (conns.length === 0) { res.json({ connected: false, accounts: [] }); return }
  const accounts = conns.map((c) => ({
    id: c.id,
    email: c.googleEmail,
    syncEnabled: c.syncEnabled,
    lastSyncedAt: c.lastSyncedAt,
    lastSyncError: c.lastSyncError,
  }))
  const { id: _id, ...first } = accounts[0]
  res.json({ connected: true, ...first, accounts })
})

/**
 * GET /api/google-calendar/connect — returns the Google consent URL.
 * The SPA redirects the browser to it. A short-lived one-time `state` row
 * (stored in mcp_oauth_state) ties the eventual callback back to this user.
 */
router.get('/connect', async (req: Request, res: Response) => {
  if (!integrationReady(res)) return
  const state = randomBytes(32).toString('hex')
  // The iOS app has no https callback to intercept (no Associated Domains on a
  // free personal team), so it asks for `?platform=ios` and the callback below
  // redirects to the app's custom URL scheme instead of the web app.
  const platform = req.query.platform === 'ios' ? 'ios' : undefined
  await db.insert(schema.mcpOauthState).values({
    key: state,
    type: STATE_TYPE,
    data: { userId: req.userId!, platform },
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  })
  res.json({ url: buildAuthUrl(state) })
})

/**
 * POST /api/google-calendar/sync — sync every connected account's primary
 * calendar now. Returns { status, upserted, pruned, accounts: [...] }; 502 only
 * when every account failed.
 */
router.post('/sync', async (req: Request, res: Response) => {
  if (!integrationReady(res)) return
  try {
    const result = await syncGoogleCalendarForUser(req.userId!)
    res.json(result)
  } catch (err) {
    console.error('[google-calendar] manual sync failed:', err)
    res.status(502).json({
      error: 'Sync failed',
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

/** Revokes the grant at Google and deletes the connection; its events go with it (ON DELETE CASCADE). */
async function disconnect(conn: typeof schema.googleCalendarConnections.$inferSelect): Promise<void> {
  try { await revokeToken(decrypt(conn.refreshTokenEnc)) } catch { /* best effort */ }
  await db.delete(schema.googleCalendarConnections)
    .where(eq(schema.googleCalendarConnections.id, conn.id))
}

/**
 * DELETE /api/google-calendar/:id — disconnect one Google account: revoke its
 * grant at Google and delete its mirrored events and stored connection.
 */
router.delete('/:id', async (req, res) => {
  // A malformed id is just "not found" (Postgres would reject it as a uuid).
  const [conn] = UUID_RE.test(req.params.id)
    ? await db.select().from(schema.googleCalendarConnections)
      .where(and(
        eq(schema.googleCalendarConnections.id, req.params.id),
        eq(schema.googleCalendarConnections.userId, req.userId!),
      ))
    : []
  if (!conn) { res.status(404).json({ error: 'Not found' }); return }
  await disconnect(conn)
  res.status(204).send()
})

/**
 * DELETE /api/google-calendar — disconnect every Google account, and remove any
 * synced events left without one (from before events were tagged by account).
 */
router.delete('/', async (req: Request, res: Response) => {
  const conns = await db.select().from(schema.googleCalendarConnections)
    .where(eq(schema.googleCalendarConnections.userId, req.userId!))
  for (const conn of conns) await disconnect(conn)
  await db.delete(schema.calendarEvents)
    .where(and(
      eq(schema.calendarEvents.userId, req.userId!),
      eq(schema.calendarEvents.source, 'google'),
    ))
  res.status(204).send()
})

export default router

// --- Public OAuth callback (mounted BEFORE the auth chain) ---

export const googleCalendarCallbackRouter = Router()

/**
 * GET /api/google-calendar/callback — Google redirects here after consent.
 * Validates the one-time state, exchanges the code for tokens, stores them
 * (encrypted), then bounces the browser back to the app's Settings page with a
 * `?google=<status>` flag the UI can surface.
 */
googleCalendarCallbackRouter.get('/', async (req: Request, res: Response) => {
  const { code, state, error } = req.query
  const stateKey = typeof state === 'string' ? state : null

  // Consume the one-time state as early as possible (even on a denied/missing-code
  // request) so we know which app to redirect back to — the iOS app watches for its
  // own URL scheme, not the web app's https URL, and it started this flow with a
  // state row same as the web app did.
  const [stateRow] = stateKey
    ? await db.select().from(schema.mcpOauthState).where(eq(schema.mcpOauthState.key, stateKey))
    : []
  if (stateKey) await db.delete(schema.mcpOauthState).where(eq(schema.mcpOauthState.key, stateKey))

  const platform = (stateRow?.data as { platform?: string } | undefined)?.platform
  const redirectBack = (status: string) =>
    res.redirect(
      platform === 'ios'
        ? `tempo://google-calendar?google=${status}`
        : `${appUrl()}/settings?google=${status}`,
    )

  if (!isGoogleOAuthConfigured() || !isEncryptionConfigured()) {
    return redirectBack('error')
  }

  if (error || typeof code !== 'string' || !stateKey) {
    return redirectBack('denied')
  }

  if (
    !stateRow ||
    stateRow.type !== STATE_TYPE ||
    (stateRow.expiresAt != null && stateRow.expiresAt.getTime() < Date.now())
  ) {
    return redirectBack('expired')
  }

  const userId = (stateRow.data as { userId?: string }).userId
  if (!userId) return redirectBack('error')

  try {
    const tokens = await exchangeCode(code)
    if (!tokens.refreshToken) {
      // Without a refresh token we can't sync long-term. This usually means the
      // user previously granted access without revoking; prompt=consent should
      // normally avoid it. Surface a retryable status.
      return redirectBack('no_refresh_token')
    }

    const email = await fetchUserEmail(tokens.accessToken)
    const enc = {
      googleEmail: email,
      accessTokenEnc: encrypt(tokens.accessToken),
      refreshTokenEnc: encrypt(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
      syncEnabled: true,
      updatedAt: new Date(),
    }

    // Another Google account adds a row; reconnecting one already connected
    // (same email) refreshes its tokens instead.
    await db.insert(schema.googleCalendarConnections)
      .values({ userId, ...enc })
      .onConflictDoUpdate({
        target: [schema.googleCalendarConnections.userId, schema.googleCalendarConnections.googleEmail],
        set: enc,
      })

    return redirectBack('connected')
  } catch (err) {
    console.error('[google-calendar] callback failed:', err)
    return redirectBack('error')
  }
})
