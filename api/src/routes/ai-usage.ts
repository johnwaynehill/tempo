import { Router } from 'express'
import { getSpendToday, usageHistory } from '../lib/ai-usage.js'

const router = Router()

// GET /api/ai-usage — today's spend against the cap, plus the last 7 days.
// Returned in snake_case on purpose: the client reads it directly.
router.get('/', async (req, res) => {
  const [today, history] = await Promise.all([
    getSpendToday(req.userId!),
    usageHistory(req.userId!, 7),
  ])
  res.json({
    today: {
      date: today.date,
      timezone: today.timezone,
      spent_usd: Number(today.spentUsd.toFixed(4)),
      cap_usd: today.capUsd,
      requests: today.requests,
      resets_at: today.resetsAt.toISOString(),
      exceeded: today.exceeded,
    },
    history: history.map((d) => ({
      date: d.date,
      requests: d.requests,
      input_tokens: d.inputTokens,
      output_tokens: d.outputTokens,
      spent_usd: Number(d.spentUsd.toFixed(4)),
    })),
  })
})

export default router
