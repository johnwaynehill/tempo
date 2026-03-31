import Anthropic from '@anthropic-ai/sdk'

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string

if (!apiKey) {
  console.warn('[Tempo AI] VITE_ANTHROPIC_API_KEY is not set — AI features will be disabled.')
}

export const anthropic = new Anthropic({
  apiKey,
  // Proxy through Vite dev server to avoid CORS issues
  baseURL: `${window.location.origin}/api/anthropic`,
  dangerouslyAllowBrowser: true,
})

export const AI_MODEL = 'claude-sonnet-4-20250514'
export const AI_ENABLED = Boolean(apiKey)
