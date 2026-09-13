/**
 * Pricing and usage math for the daily AI spend cap. Pure functions only —
 * no database, no Express — so they can be exercised from a script.
 */

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

/** USD per million tokens. Cache writes bill at 1.25× input, cache reads at 0.1×. */
interface ModelPrice {
  input: number
  output: number
}

/**
 * The models Tempo is allowed to call through the proxy. Anything else is
 * rejected before it reaches Anthropic, so a leaked key can't be pointed at a
 * pricier model. Sonnet 4.5 is billed at the Sonnet 4.6 tier rate. Sonnet 4 is
 * retired upstream (404) and deliberately absent.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
}

const CACHE_WRITE_MULTIPLIER = 1.25
const CACHE_READ_MULTIPLIER = 0.1

export const DEFAULT_DAILY_CAP_USD = 2
/** Nothing in Tempo asks for more than 2048; this bounds a hostile request. */
export const MAX_OUTPUT_TOKENS = 4096

export function isAllowedModel(model: unknown): model is string {
  return typeof model === 'string' && model in MODEL_PRICES
}

/** `AI_DAILY_CAP_USD` env; 0 disables the cap. */
export function dailyCapUsd(env: Record<string, string | undefined> = process.env): number {
  const raw = env.AI_DAILY_CAP_USD
  if (raw === undefined || raw === '') return DEFAULT_DAILY_CAP_USD
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_CAP_USD
}

export function costUsd(model: string, usage: TokenUsage): number {
  const price = MODEL_PRICES[model]
  if (!price) return 0
  const perTok = 1 / 1_000_000
  return (
    (usage.input_tokens ?? 0) * price.input * perTok +
    (usage.cache_creation_input_tokens ?? 0) * price.input * CACHE_WRITE_MULTIPLIER * perTok +
    (usage.cache_read_input_tokens ?? 0) * price.input * CACHE_READ_MULTIPLIER * perTok +
    (usage.output_tokens ?? 0) * price.output * perTok
  )
}

/**
 * Rough input size for a request whose response never reported usage (a
 * stream aborted before `message_start`). Anthropic still bills the input, so
 * charge ~4 characters per token rather than nothing.
 */
export function estimateInputTokens(body: unknown): number {
  try {
    return Math.ceil(JSON.stringify(body ?? '').length / 4)
  } catch {
    return 0
  }
}

/**
 * Pull the final usage out of a Messages API SSE stream: `message_start`
 * carries input (and cache) tokens, and the last `message_delta` carries the
 * cumulative output tokens. Null when the stream never reached `message_start`.
 */
export function parseSseUsage(sse: string): TokenUsage | null {
  let usage: TokenUsage | null = null
  for (const line of sse.split('\n')) {
    if (!line.startsWith('data:')) continue
    let event: { type?: string; message?: { usage?: Partial<TokenUsage> }; usage?: Partial<TokenUsage> }
    try {
      event = JSON.parse(line.slice(5).trim())
    } catch {
      continue
    }
    if (event.type === 'message_start' && event.message?.usage) {
      const u = event.message.usage
      usage = {
        input_tokens: u.input_tokens ?? 0,
        output_tokens: u.output_tokens ?? 0,
        cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
      }
    } else if (event.type === 'message_delta' && event.usage && usage) {
      if (typeof event.usage.output_tokens === 'number') usage.output_tokens = event.usage.output_tokens
      if (typeof event.usage.input_tokens === 'number') usage.input_tokens = event.usage.input_tokens
    }
  }
  return usage
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>()
function formatter(tz: string): Intl.DateTimeFormat {
  let f = dateFormatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
    dateFormatters.set(tz, f)
  }
  return f
}

function safeParts(tz: string, now: Date): Record<string, string> {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = formatter(tz).formatToParts(now)
  } catch {
    parts = formatter('UTC').formatToParts(now)
  }
  const out: Record<string, string> = {}
  for (const p of parts) out[p.type] = p.value
  return out
}

/** "2026-09-13" in the user's timezone. Falls back to UTC on a bad zone. */
export function localDate(tz: string, now: Date = new Date()): string {
  const p = safeParts(tz, now)
  return `${p.year}-${p.month}-${p.day}`
}

/** The instant the user's next local day begins (DST shifts are off by at most an hour). */
export function nextLocalMidnight(tz: string, now: Date = new Date()): Date {
  const p = safeParts(tz, now)
  const hour = Number(p.hour) % 24 // some engines report "24" for midnight
  const secondsIntoDay = hour * 3600 + Number(p.minute) * 60 + Number(p.second)
  return new Date(now.getTime() + (86400 - secondsIntoDay) * 1000)
}
