import { onRequest } from 'firebase-functions/v2/https'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { defineSecret } from 'firebase-functions/params'

initializeApp()

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY')

const ANTHROPIC_BASE = 'https://api.anthropic.com'
const ALLOWED_PATHS = ['/v1/messages']

/**
 * Proxy for Anthropic API requests.
 *
 * - Verifies the caller is an authenticated Firebase user
 * - Injects the Anthropic API key server-side
 * - Supports streaming (SSE) responses for messages.stream()
 */
export const anthropicProxy = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: [anthropicApiKey],
    timeoutSeconds: 300,
    memory: '256MiB',
    region: 'us-central1',
  },
  async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    // Verify Firebase auth token
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' })
      return
    }

    const idToken = authHeader.slice(7)
    try {
      await getAuth().verifyIdToken(idToken)
    } catch {
      res.status(401).json({ error: 'Invalid Firebase ID token' })
      return
    }

    // Forward the request to Anthropic
    const apiPath = req.path
    if (!apiPath || !ALLOWED_PATHS.includes(apiPath)) {
      res.status(403).json({ error: 'Forbidden API path' })
      return
    }
    const targetUrl = `${ANTHROPIC_BASE}${apiPath}`

    const body = JSON.stringify(req.body)
    const isStreaming = req.body?.stream === true

    try {
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicApiKey.value(),
          'anthropic-version': (req.headers['anthropic-version'] as string) || '2023-06-01',
        },
        body,
      })

      // Forward status code
      res.status(upstream.status)

      if (isStreaming && upstream.ok && upstream.body) {
        // Stream SSE response
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        const reader = upstream.body.getReader()
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
        // Non-streaming: forward JSON response
        const data = await upstream.text()
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
        res.send(data)
      }
    } catch (err) {
      console.error('[anthropicProxy] Upstream error:', err)
      res.status(502).json({ error: 'Failed to reach Anthropic API' })
    }
  },
)
