/**
 * Thin wrapper around Google's OAuth 2.0 + OpenID Connect endpoints.
 *
 * Uses plain `fetch` (no `googleapis` dependency) to match the repo's
 * fetch-based Anthropic integration and keep the dependency surface small.
 *
 * Required env (API service):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_OAUTH_REDIRECT_URI   — must exactly match an authorized redirect URI
 *                                 in the Google Cloud console OAuth client, e.g.
 *                                 https://<api-host>/api/google-calendar/callback
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo'

// Read-only calendar access + identity (so we can show which account is linked).
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
]

/** True when the three Google OAuth env vars are present. */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
  )
}

function requireConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI)')
  }
  return { clientId, clientSecret, redirectUri }
}

/** Builds the Google consent-screen URL the browser is redirected to. */
export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = requireConfig()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',          // request a refresh token
    prompt: 'consent',               // force consent so a refresh token is reliably returned
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export interface GoogleTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
  scope: string
}

/** Exchanges an authorization code (from the callback) for tokens. */
export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = requireConfig()
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  }
  const json = await res.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope: string
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
    scope: json.scope,
  }
}

/** Trades a stored refresh token for a fresh access token. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<Omit<GoogleTokens, 'refreshToken'>> {
  const { clientId, clientSecret } = requireConfig()
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`)
  }
  const json = await res.json() as { access_token: string; expires_in: number; scope: string }
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
    scope: json.scope,
  }
}

/** Looks up the connected account's email for display. Best-effort. */
export async function fetchUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const json = await res.json() as { email?: string }
  return json.email ?? null
}

/** Revokes a token at Google. Best-effort — never throws. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    })
  } catch {
    /* best effort */
  }
}
