import { Router } from 'express'
import type { Request, Response } from 'express'

const router = Router()

const ANTHROPIC_BASE = 'https://api.anthropic.com'
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

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(decoder.decode(value, { stream: true }))
        }
      } finally {
        res.end()
      }
    } else {
      const data = await upstream.text()
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
      res.send(data)
    }
  } catch (err) {
    console.error('[anthropic proxy] Upstream error:', err)
    res.status(502).json({ error: 'Failed to reach Anthropic API' })
  }
})

export default router
