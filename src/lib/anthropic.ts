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

// Sonnet 4 was retired (the API now 404s on it). Sonnet 5 runs adaptive thinking by
// default, which the one-line helpers don't want — every call passes AI_THINKING_OFF.
export const AI_MODEL = 'claude-sonnet-5'
export const AI_THINKING_OFF = { type: 'disabled' } as const

export const AI_BUDGET_MESSAGE = "Tempo AI is resting until tomorrow. Today's AI budget is used up."

/** The proxy's daily-cap refusal: a 429 whose body is `{ error: { type: 'ai_budget_exceeded' } }`. */
export function isBudgetError(err: unknown): boolean {
  if (!(err instanceof Anthropic.APIError)) return false
  const body = err.error as { type?: string } | undefined
  return err.status === 429 && body?.type === 'ai_budget_exceeded'
}

// AI is enabled if we have a key (dev) or we're in production (proxy always available)
export const AI_ENABLED = isDev ? Boolean(devApiKey) : true
