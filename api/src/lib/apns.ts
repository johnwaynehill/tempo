import { connect, constants, type ClientHttp2Session } from 'node:http2'
import { createPrivateKey, sign, type KeyObject } from 'node:crypto'

// Apple Push Notification service client: token-based auth (a .p8 signing key) over
// HTTP/2, with Node's built-ins only. Configured by env:
//   APNS_KEY        the .p8 file's contents (PEM; literal "\n" sequences are accepted)
//   APNS_KEY_ID     the key's 10-character ID from the developer portal
//   APNS_TEAM_ID    the Apple Developer team ID
//   APNS_BUNDLE_ID  the app's bundle ID, the push "topic" (default com.johnwaynehill.Tempo)
// Unset → apnsConfigured() is false and nothing is sent.

export type ApnsEnvironment = 'sandbox' | 'production'

export interface ApnsNotification {
  title: string
  body: string
  /** Groups notifications in Notification Center. */
  threadId?: string
  /** A later push with the same id replaces the earlier one on the device. */
  collapseId?: string
  /** Extra top-level keys for the app (e.g. todoId), next to `aps`. */
  data?: Record<string, string>
}

export type ApnsResult =
  | { ok: true }
  /** `gone` means the token will never work again and should be forgotten. */
  | { ok: false; status: number; reason: string; gone: boolean }

const HOSTS: Record<ApnsEnvironment, string> = {
  sandbox: 'https://api.sandbox.push.apple.com',
  production: 'https://api.push.apple.com',
}

/** Reasons that mean the device token itself is dead or belongs elsewhere. */
const GONE_REASONS = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic', 'ExpiredToken'])

interface Config { key: KeyObject; keyId: string; teamId: string; bundleId: string }

let config: Config | null | undefined
function loadConfig(): Config | null {
  if (config !== undefined) return config
  const raw = process.env.APNS_KEY
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  if (!raw || !keyId || !teamId) {
    config = null
    return config
  }
  config = {
    key: createPrivateKey(raw.replace(/\\n/g, '\n')),
    keyId,
    teamId,
    bundleId: process.env.APNS_BUNDLE_ID || 'com.johnwaynehill.Tempo',
  }
  return config
}

export function apnsConfigured(): boolean {
  return loadConfig() !== null
}

export function apnsBundleId(): string | null {
  return loadConfig()?.bundleId ?? null
}

// --- Provider token (JWT, ES256). Apple wants it refreshed at most every 20 minutes and
// rejects one older than an hour; 40 minutes sits safely between.

let jwt: { token: string; issuedAt: number } | null = null
const JWT_LIFETIME_MS = 40 * 60_000

const base64url = (input: Buffer | string) => Buffer.from(input).toString('base64url')

/** The current provider token (exported for verification scripts). */
export function apnsProviderToken(now = Date.now()): string | null {
  const cfg = loadConfig()
  return cfg ? providerToken(cfg, now) : null
}

function providerToken(cfg: Config, now = Date.now()): string {
  if (jwt && now - jwt.issuedAt < JWT_LIFETIME_MS) return jwt.token
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId }))
  const claims = base64url(JSON.stringify({ iss: cfg.teamId, iat: Math.floor(now / 1000) }))
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key: cfg.key, dsaEncoding: 'ieee-p1363' })
  jwt = { token: `${header}.${claims}.${base64url(signature)}`, issuedAt: now }
  return jwt.token
}

// --- One long-lived HTTP/2 connection per environment, reopened when it drops.

const sessions = new Map<ApnsEnvironment, ClientHttp2Session>()

function session(environment: ApnsEnvironment): ClientHttp2Session {
  const existing = sessions.get(environment)
  if (existing && !existing.closed && !existing.destroyed) return existing
  const created = connect(HOSTS[environment])
  created.on('error', (err) => console.error(`[apns] ${environment} connection error:`, err.message))
  created.on('close', () => { if (sessions.get(environment) === created) sessions.delete(environment) })
  // Don't keep the process alive just for an idle push connection.
  created.unref()
  sessions.set(environment, created)
  return created
}

export function apnsPayload(n: ApnsNotification): string {
  return JSON.stringify({
    aps: {
      alert: { title: n.title, body: n.body },
      sound: 'default',
      ...(n.threadId ? { 'thread-id': n.threadId } : {}),
    },
    ...(n.data ?? {}),
  })
}

/** Sends one alert to one device. Never throws: failures come back as a result. */
export async function sendApns(
  deviceToken: string,
  environment: ApnsEnvironment,
  notification: ApnsNotification,
): Promise<ApnsResult> {
  const cfg = loadConfig()
  if (!cfg) return { ok: false, status: 0, reason: 'NotConfigured', gone: false }

  const body = apnsPayload(notification)
  return new Promise<ApnsResult>((resolve) => {
    let settled = false
    const finish = (result: ApnsResult) => { if (!settled) { settled = true; resolve(result) } }
    try {
      const req = session(environment).request({
        [constants.HTTP2_HEADER_METHOD]: 'POST',
        [constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
        authorization: `bearer ${providerToken(cfg)}`,
        'apns-topic': cfg.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        ...(notification.collapseId ? { 'apns-collapse-id': notification.collapseId.slice(0, 64) } : {}),
        'content-type': 'application/json',
      })
      let status = 0
      let text = ''
      req.setEncoding('utf8')
      req.on('response', (headers) => { status = Number(headers[constants.HTTP2_HEADER_STATUS]) })
      req.on('data', (chunk: string) => { text += chunk })
      req.on('end', () => {
        if (status === 200) return finish({ ok: true })
        let reason = text || `HTTP ${status}`
        try { reason = (JSON.parse(text) as { reason?: string }).reason ?? reason } catch { /* not JSON */ }
        finish({ ok: false, status, reason, gone: status === 410 || GONE_REASONS.has(reason) })
      })
      req.on('error', (err) => finish({ ok: false, status: 0, reason: err.message, gone: false }))
      req.setTimeout(10_000, () => {
        req.close(constants.NGHTTP2_CANCEL)
        finish({ ok: false, status: 0, reason: 'Timeout', gone: false })
      })
      req.end(body)
    } catch (err) {
      finish({ ok: false, status: 0, reason: err instanceof Error ? err.message : String(err), gone: false })
    }
  })
}
