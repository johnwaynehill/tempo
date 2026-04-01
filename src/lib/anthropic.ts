import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/firebase'

// In dev, use the Vite proxy with the local API key.
// In production, use the Cloud Function proxy (no client-side key needed).
const isDev = import.meta.env.DEV
const devApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

const proxyUrl = isDev
  ? `${window.location.origin}/api/anthropic`
  : (import.meta.env.VITE_ANTHROPIC_PROXY_URL as string | undefined)

if (isDev && !devApiKey) {
  console.warn('[Tempo AI] VITE_ANTHROPIC_API_KEY is not set — AI features will be disabled in dev.')
}

if (!isDev && !proxyUrl) {
  console.warn('[Tempo AI] VITE_ANTHROPIC_PROXY_URL is not set — AI features will be disabled in production.')
}

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
  // The SDK requires a non-empty string, so we pass a placeholder for prod.
  apiKey: isDev ? (devApiKey || 'not-set') : 'proxy-managed',
  baseURL: proxyUrl || '/api/anthropic',
  dangerouslyAllowBrowser: true,
  fetch: authedFetch,
})

export const AI_MODEL = 'claude-sonnet-4-20250514'

// AI is enabled if we have a key (dev) or a proxy URL (prod)
export const AI_ENABLED = isDev ? Boolean(devApiKey) : Boolean(proxyUrl)
