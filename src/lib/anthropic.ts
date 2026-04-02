import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/firebase'

const isDev = import.meta.env.DEV
const devApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

// Production proxy URL — Cloud Function that injects the API key server-side
const PROD_PROXY_URL = 'https://anthropicproxy-blb4phnqna-uc.a.run.app'

const proxyUrl = isDev
  ? `${window.location.origin}/api/anthropic`
  : PROD_PROXY_URL

/**
 * Custom fetch that attaches the Firebase ID token for production proxy auth.
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
