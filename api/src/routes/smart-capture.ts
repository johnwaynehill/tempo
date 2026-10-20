import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getSpendToday, recordUsage } from '../lib/ai-usage.js'
import type { TokenUsage } from '../lib/ai-pricing.js'
import {
  SMART_CAPTURE_MIN_CHARS,
  SMART_CAPTURE_MODEL,
  parseSmartSuggestions,
  smartCaptureSystemPrompt,
} from '../lib/smart-capture.js'

// POST /api/smart-capture { title } → { suggestions: SmartSuggestions | null }
// Mounted behind requireScope('ai') and the AI rate limit; counts against the daily AI cap.

const router = Router()
const TIMEOUT_MS = 10_000

router.post('/', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  if (title.length < SMART_CAPTURE_MIN_CHARS) {
    res.json({ suggestions: null }); return
  }
  if (title.length > 500) {
    res.status(400).json({ error: 'title is too long' }); return
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'AI is not configured' }); return
  }

  const spend = await getSpendToday(req.userId!)
  if (spend.exceeded) {
    res.status(429).json({ error: 'ai_budget_exceeded', resetsAt: spend.resetsAt.toISOString() }); return
  }

  const projects = await db
    .select({ name: schema.projects.name })
    .from(schema.projects)
    .where(eq(schema.projects.userId, req.userId!))
  const projectNames = projects.map((p) => p.name)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SMART_CAPTURE_MODEL,
        max_tokens: 120,
        thinking: { type: 'disabled' },
        system: smartCaptureSystemPrompt(spend.date, projectNames),
        messages: [{ role: 'user', content: title }],
      }),
      signal: controller.signal,
    })
    if (!upstream.ok) {
      console.warn('[smart-capture] Anthropic returned', upstream.status)
      res.status(502).json({ error: 'AI request failed' }); return
    }
    const data = (await upstream.json()) as { content?: { type: string; text?: string }[]; usage?: TokenUsage }
    if (data.usage) void recordUsage(req.userId!, spend.date, SMART_CAPTURE_MODEL, data.usage)
    const text = data.content?.find((c) => c.type === 'text')?.text
    res.json({ suggestions: parseSmartSuggestions(text, projectNames) })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    console.warn('[smart-capture] failed:', aborted ? 'timeout' : err)
    res.status(aborted ? 504 : 502).json({ error: 'AI request failed' })
  } finally {
    clearTimeout(timeout)
  }
})

export default router
