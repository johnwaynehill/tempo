import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/firebase'

const isDev = import.meta.env.DEV
const devApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

const API_BASE = import.meta.env.VITE_API_URL || 'https://tempo-api-production.up.railway.app'

const proxyUrl = isDev
  ? `${window.location.origin}/api/anthropic`
  : `${API_BASE}/api/anthropic`

/**
 * Custom fetch that attaches the Firebase ID token for proxy auth.
 * In dev mode, uses plain fetch (Vite proxy doesn't need auth).
 */
const authedFetch: typeof globalThis.fetch = async (input, init) => {
  if (!isDev && auth.currentUser) {
    const token = await auth.currentUser.getIdToken()
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return globalThis.fetch(input, { ...init, headers })
  }
  return globalThis.fetch(input, init)
}

export const anthropic = new Anthropic({
  // In dev, use the real key; in prod, the proxy injects it server-side.
  apiKey: isDev ? (devApiKey || 'not-set') : 'proxy-managed',
  baseURL: proxyUrl,
  dangerouslyAllowBrowser: true,
  fetch: authedFetch,
})

export const AI_MODEL = 'claude-sonnet-4-20250514'

// AI is enabled if we have a key (dev) or we're in production (proxy always available)
export const AI_ENABLED = isDev ? Boolean(devApiKey) : true
