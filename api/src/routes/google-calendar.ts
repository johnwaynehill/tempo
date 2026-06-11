/**
 * Google Calendar integration — OAuth connect/disconnect + status.
 *
 * Phase 1 establishes the account link only; event syncing is layered on later.
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
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { encrypt, decrypt, isEncryptionConfigured } from '../lib/crypto.js'
import {
  buildAuthUrl,
  exchangeCode,
  fetchUserEmail,
  revokeToken,
  isGoogleOAuthConfigured,
} from '../lib/google-oauth.js'

const STATE_TYPE = 'google_oauth_state'
const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

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

/** GET /api/google-calendar/status — connection state for the Settings UI. */
router.get('/status', async (req: Request, res: Response) => {
  const [conn] = await db.select().from(schema.googleCalendarConnections)
    .where(eq(schema.googleCalendarConnections.userId, req.userId!))
  if (!conn) { res.json({ connected: false }); return }
  res.json({
    connected: true,
    email: conn.googleEmail,
    syncEnabled: conn.syncEnabled,
    lastSyncedAt: conn.lastSyncedAt,
    lastSyncError: conn.lastSyncError,
  })
})

/**
 * GET /api/google-calendar/connect — returns the Google consent URL.
 * The SPA redirects the browser to it. A short-lived one-time `state` row
 * (stored in mcp_oauth_state) ties the eventual callback back to this user.
 */
router.get('/connect', async (req: Request, res: Response) => {
  if (!integrationReady(res)) return
  const state = randomBytes(32).toString('hex')
  await db.insert(schema.mcpOauthState).values({
    key: state,
    type: STATE_TYPE,
    data: { userId: req.userId! },
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  })
  res.json({ url: buildAuthUrl(state) })
})

/**
 * DELETE /api/google-calendar — disconnect: revoke the grant at Google and drop
 * the stored connection. (Mirrored events get purged once sync exists.)
 */
router.delete('/', async (req: Request, res: Response) => {
  const [conn] = await db.select().from(schema.googleCalendarConnections)
    .where(eq(schema.googleCalendarConnections.userId, req.userId!))
  if (conn) {
    try { await revokeToken(decrypt(conn.refreshTokenEnc)) } catch { /* best effort */ }
    await db.delete(schema.googleCalendarConnections)
      .where(eq(schema.googleCalendarConnections.userId, req.userId!))
  }
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
  const redirectBack = (status: string) =>
    res.redirect(`${appUrl()}/settings?google=${status}`)

  if (!isGoogleOAuthConfigured() || !isEncryptionConfigured()) {
    return redirectBack('error')
  }

  const { code, state, error } = req.query
  if (error || typeof code !== 'string' || typeof state !== 'string') {
    return redirectBack('denied')
  }

  // Validate + consume the one-time state (delete regardless of outcome).
  const [stateRow] = await db.select().from(schema.mcpOauthState)
    .where(eq(schema.mcpOauthState.key, state))
  await db.delete(schema.mcpOauthState).where(eq(schema.mcpOauthState.key, state))

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

    await db.insert(schema.googleCalendarConnections)
      .values({ userId, ...enc })
      .onConflictDoUpdate({
        target: schema.googleCalendarConnections.userId,
        set: enc,
      })

    return redirectBack('connected')
  } catch (err) {
    console.error('[google-calendar] callback failed:', err)
    return redirectBack('error')
  }
})
