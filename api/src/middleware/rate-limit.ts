import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { Request } from 'express'

// Pre-auth limiter — keyed by IP. Catches brute-force attempts on API keys
// and abuse from unauthenticated sources.
export const ipRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? 'unknown'),
  message: { error: 'Too many requests from this IP. Try again in a minute.' },
})

// Post-auth limiter — keyed by userId. Protects against valid-credential abuse.
export const userRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
  message: { error: 'Rate limit exceeded. Slow down.' },
})

// Stricter limiter for the Anthropic proxy — AI calls are expensive.
export const anthropicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
  message: { error: 'AI request rate limit exceeded. Wait a minute.' },
})
