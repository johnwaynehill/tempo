import type { Request, Response, NextFunction } from 'express'
import { isAllowedModel, MAX_OUTPUT_TOKENS, MODEL_PRICES } from '../lib/ai-pricing.js'
import { getSpendToday } from '../lib/ai-usage.js'

declare global {
  namespace Express {
    interface Request {
      /** Set by aiBudget for the proxy route to record the call against. */
      aiUsage?: { date: string; model: string }
    }
  }
}

/**
 * Sits in front of the Anthropic proxy. Three checks, cheapest first:
 * the model must be one Tempo uses, max_tokens is clamped, and the user's
 * spend for their local day must be under the cap. Errors are shaped like
 * Anthropic's own (`{ type: 'error', error: { type, message } }`) so the
 * browser SDK surfaces them as APIError with a readable `error.type`.
 */
export async function aiBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>

  if (!isAllowedModel(body.model)) {
    res.status(400).json({
      type: 'error',
      error: {
        type: 'model_not_allowed',
        message: `Model not allowed through the Tempo proxy. Allowed: ${Object.keys(MODEL_PRICES).join(', ')}.`,
      },
    })
    return
  }

  if (typeof body.max_tokens !== 'number' || body.max_tokens > MAX_OUTPUT_TOKENS) {
    body.max_tokens = MAX_OUTPUT_TOKENS
  }

  try {
    const spend = await getSpendToday(req.userId!)
    if (spend.exceeded) {
      res.status(429).json({
        type: 'error',
        error: {
          type: 'ai_budget_exceeded',
          message: `Daily AI budget of $${spend.capUsd.toFixed(2)} reached. Tempo AI is resting until ${spend.resetsAt.toISOString()}.`,
          cap_usd: spend.capUsd,
          spent_usd: Number(spend.spentUsd.toFixed(4)),
          resets_at: spend.resetsAt.toISOString(),
        },
      })
      return
    }
    req.aiUsage = { date: spend.date, model: body.model }
  } catch (err) {
    // A failed budget lookup shouldn't take AI down; the call is recorded against UTC today.
    console.error('[ai-budget] lookup failed, allowing request:', err)
    req.aiUsage = { date: new Date().toISOString().slice(0, 10), model: body.model }
  }

  next()
}
