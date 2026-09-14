import { Router } from 'express'
import type { Request, Response } from 'express'
import { parseSseUsage, estimateInputTokens } from '../lib/ai-pricing.js'
import type { TokenUsage } from '../lib/ai-pricing.js'
import { recordUsage } from '../lib/ai-usage.js'

const router = Router()

const ANTHROPIC_BASE = 'https://api.anthropic.com'

/** Charge the call to the user's day. `usage` null means the response never reported it. */
function settle(req: Request, usage: TokenUsage | null): void {
  if (!req.userId || !req.aiUsage) return
  const charged = usage ?? { input_tokens: estimateInputTokens(req.body), output_tokens: 0 }
  void recordUsage(req.userId, req.aiUsage.date, req.aiUsage.model, charged)
}
const ALLOWED_PATHS = ['/v1/messages']

// POST /api/anthropic/v1/messages
// Proxies to Anthropic API, injecting the API key server-side.
// Supports streaming (SSE) responses.
router.post('/v1/messages', async (req: Request, res: Response) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
    return
  }

  const body = JSON.stringify(req.body)
  const isStreaming = req.body?.stream === true

  try {
    const upstream = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': (req.headers['anthropic-version'] as string) || '2023-06-01',
      },
      body,
    })

    res.status(upstream.status)

    if (isStreaming && upstream.ok && upstream.body) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const reader = (upstream.body as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()
      // Keep a copy of the stream so the final usage can be charged once it ends.
      let transcript = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          transcript += chunk
          res.write(chunk)
        }
      } finally {
        res.end()
        settle(req, parseSseUsage(transcript))
      }
    } else {
      const data = await upstream.text()
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
      res.send(data)
      if (upstream.ok) {
        let usage: TokenUsage | null = null
        try {
          usage = (JSON.parse(data) as { usage?: TokenUsage }).usage ?? null
        } catch {}
        settle(req, usage)
      }
    }
  } catch (err) {
    console.error('[anthropic proxy] Upstream error:', err)
    res.status(502).json({ error: 'Failed to reach Anthropic API' })
  }
})

export default router
