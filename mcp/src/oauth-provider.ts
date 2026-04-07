import { randomUUID } from 'node:crypto'
import type { Response } from 'express'
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { api } from './api.js'

// --- Client Store (persisted via Tempo API) ---

class TempoClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string) {
    return await api.mcpOauth.get<OAuthClientInformationFull>('client', clientId) ?? undefined
  }

  async registerClient(client: OAuthClientInformationFull) {
    await api.mcpOauth.set('client', client.client_id, client)
    return client
  }
}

// --- Token Data ---

interface TokenData {
  clientId: string
  scopes: string[]
  expiresAt: number // ms since epoch
  resource?: string
}

interface CodeData {
  client: OAuthClientInformationFull
  params: AuthorizationParams
  resourceStr?: string
}

// --- OAuth Provider (persisted via Tempo API) ---

export class TempoOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new TempoClientsStore()

  // Auth codes are short-lived (seconds) — in-memory is fine
  private codes = new Map<string, CodeData>()

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const req = res.req

    // Second pass: user clicked Approve
    if (req.body?.approved === 'true') {
      const code = randomUUID()
      this.codes.set(code, {
        client,
        params,
        resourceStr: params.resource?.toString(),
      })

      const target = new URL(params.redirectUri)
      target.searchParams.set('code', code)
      if (params.state) target.searchParams.set('state', params.state)
      res.redirect(302, target.toString())
      return
    }

    // Second pass: user clicked Deny
    if (req.body?.denied === 'true') {
      const target = new URL(params.redirectUri)
      target.searchParams.set('error', 'access_denied')
      target.searchParams.set('error_description', 'User denied the request')
      if (params.state) target.searchParams.set('state', params.state)
      res.redirect(302, target.toString())
      return
    }

    // First pass: show consent page
    const clientName = (client as Record<string, unknown>).client_name as string || 'An application'
    const scopeDisplay = params.scopes?.length ? params.scopes.join(', ') : 'full access'

    res.setHeader('Content-Type', 'text/html')
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize — Tempo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 420px; width: 100%; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    h1 { font-size: 20px; margin-bottom: 8px; color: #1a1a1a; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
    .client-name { font-weight: 600; color: #1a1a1a; }
    .scope { background: #f0f0f0; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #444; margin-bottom: 24px; }
    .actions { display: flex; gap: 12px; }
    button { flex: 1; padding: 12px; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer; border: none; }
    .approve { background: #2563eb; color: white; }
    .approve:hover { background: #1d4ed8; }
    .deny { background: #f0f0f0; color: #333; }
    .deny:hover { background: #e5e5e5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize access to Tempo</h1>
    <p class="subtitle"><span class="client-name">${escapeHtml(clientName)}</span> wants to access your Tempo data.</p>
    <div class="scope">Permissions: ${escapeHtml(scopeDisplay)}</div>
    <div class="actions">
      <form method="POST" action="/authorize" style="flex:1;display:flex;">
        ${hiddenFields(client, params)}
        <input type="hidden" name="denied" value="true">
        <button type="submit" class="deny">Deny</button>
      </form>
      <form method="POST" action="/authorize" style="flex:1;display:flex;">
        ${hiddenFields(client, params)}
        <input type="hidden" name="approved" value="true">
        <button type="submit" class="approve">Approve</button>
      </form>
    </div>
  </div>
</body>
</html>`)
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const data = this.codes.get(authorizationCode)
    if (!data) throw new Error('Invalid authorization code')
    return data.params.codeChallenge
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens> {
    const data = this.codes.get(authorizationCode)
    if (!data) throw new Error('Invalid authorization code')
    if (data.client.client_id !== client.client_id) throw new Error('Code was not issued to this client')

    this.codes.delete(authorizationCode)

    const accessToken = randomUUID()
    const refreshToken = randomUUID()
    const scopes = data.params.scopes || []
    const expiresAt = Date.now() + 3600_000 // 1 hour

    const tokenData: TokenData = {
      clientId: client.client_id,
      scopes,
      expiresAt,
      resource: data.resourceStr,
    }

    await Promise.all([
      api.mcpOauth.set('access_token', accessToken, tokenData, new Date(expiresAt).toISOString()),
      api.mcpOauth.set('refresh_token', refreshToken, {
        clientId: client.client_id,
        scopes,
        resource: data.resourceStr,
      }),
    ])

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    }
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[]): Promise<OAuthTokens> {
    const data = await api.mcpOauth.get<{ clientId: string; scopes: string[]; resource?: string }>('refresh_token', refreshToken)
    if (!data) throw new Error('Invalid refresh token')
    if (data.clientId !== client.client_id) throw new Error('Refresh token was not issued to this client')

    const accessToken = randomUUID()
    const finalScopes = scopes?.length ? scopes : data.scopes
    const expiresAt = Date.now() + 3600_000

    await api.mcpOauth.set('access_token', accessToken, {
      clientId: client.client_id,
      scopes: finalScopes,
      expiresAt,
      resource: data.resource,
    } satisfies TokenData, new Date(expiresAt).toISOString())

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: finalScopes.join(' '),
    }
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const data = await api.mcpOauth.get<TokenData>('access_token', token)
    if (!data || data.expiresAt < Date.now()) {
      throw new Error('Invalid or expired token')
    }
    return {
      token,
      clientId: data.clientId,
      scopes: data.scopes,
      expiresAt: Math.floor(data.expiresAt / 1000),
    }
  }

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    await Promise.all([
      api.mcpOauth.delete('access_token', request.token),
      api.mcpOauth.delete('refresh_token', request.token),
    ])
  }
}

// --- Helpers ---

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function hiddenFields(client: OAuthClientInformationFull, params: AuthorizationParams): string {
  const fields: Record<string, string> = {
    client_id: client.client_id,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  }
  if (params.state) fields.state = params.state
  if (params.scopes?.length) fields.scope = params.scopes.join(' ')
  if (params.resource) fields.resource = params.resource.toString()

  return Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}">`)
    .join('\n        ')
}
