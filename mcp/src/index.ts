#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import cors from 'cors'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { createServer } from './server.js'
import { TempoOAuthProvider } from './oauth-provider.js'

const STDIO_MODE = process.argv.includes('--stdio')

// ========================
// STDIO MODE (local dev)
// ========================

if (STDIO_MODE) {
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
} else {

  // ========================
  // HTTP MODE (remote)
  // ========================

  const ICON_SVG = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M376 0H136C60.8893 0 0 60.8893 0 136V376C0 451.111 60.8893 512 136 512H376C451.111 512 512 451.111 512 376V136C512 60.8893 451.111 0 376 0Z" fill="url(#tempo-bg)"/><path d="M366 96H130C106.804 96 88 112.118 88 132V156C88 175.882 106.804 192 130 192H366C389.196 192 408 175.882 408 156V132C408 112.118 389.196 96 366 96Z" fill="#F4F1EC"/><path d="M256 152C256 121.072 234.51 96 208 96C181.49 96 160 121.072 160 152V368C160 398.928 181.49 424 208 424C234.51 424 256 398.928 256 368V152Z" fill="#F4F1EC"/><path d="M356 424C384.719 424 408 400.719 408 372C408 343.281 384.719 320 356 320C327.281 320 304 343.281 304 372C304 400.719 327.281 424 356 424Z" fill="#F4F1EC"/><defs><linearGradient id="tempo-bg" x1="52" y1="36" x2="470" y2="470" gradientUnits="userSpaceOnUse"><stop stop-color="#9BAAA2"/><stop offset="1" stop-color="#465A53"/></linearGradient></defs></svg>`

  const PORT = parseInt(process.env.PORT || '3001', 10)
  const API_BASE = process.env.TEMPO_API_URL || 'https://tempo-api-production.up.railway.app'
  const SERVER_URL = new URL(process.env.PUBLIC_URL || `http://localhost:${PORT}`)
  const MCP_URL = new URL('/mcp', SERVER_URL)

  const app = createMcpExpressApp({ host: '0.0.0.0' })
  const oauthProvider = new TempoOAuthProvider()

  // CORS — allow Claude.ai and other browser clients
  app.use(cors())

  // OAuth routes — adds /authorize, /token, /register, /.well-known/*
  app.use(mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: SERVER_URL,
    resourceServerUrl: MCP_URL,
    resourceName: 'Tempo MCP Server',
    scopesSupported: ['mcp:tools'],
  }))

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'tempo-mcp' })
  })

  // Serve app icon for Claude.ai integration
  app.get('/icon.svg', (_req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(ICON_SVG)
  })

  // Dual auth middleware — API key (Claude Code) OR Bearer token (Claude.ai OAuth)
  const bearerAuth = requireBearerAuth({
    verifier: oauthProvider,
    requiredScopes: [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(MCP_URL),
  })

  app.use('/mcp', async (req, res, next) => {
    // Path 1: X-API-Key header (Claude Code) — validate against backend
    const apiKey = req.headers['x-api-key'] as string | undefined
    if (apiKey && apiKey.startsWith('tempo_')) {
      try {
        const resp = await fetch(`${API_BASE}/api/preferences`, {
          headers: { 'X-API-Key': apiKey },
        })
        if (resp.ok) {
          ;(req as any).tempoApiKey = apiKey
          return next()
        }
      } catch { /* fall through to bearer auth */ }
      res.status(401).json({ error: 'Invalid API key' })
      return
    }

    // Path 2: Bearer token (Claude.ai via OAuth)
    bearerAuth(req, res, next)
  })

  // Session management
  const transports: Record<string, StreamableHTTPServerTransport> = {}

  // POST /mcp — main MCP endpoint
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    try {
      let transport: StreamableHTTPServerTransport

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId]
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports[id] = transport
          },
        })

        transport.onclose = () => {
          const sid = transport.sessionId
          if (sid && transports[sid]) {
            delete transports[sid]
          }
        }

        const server = createServer((req as any).tempoApiKey)
        await server.connect(transport)
        await transport.handleRequest(req, res, req.body)
        return
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID' },
          id: null,
        })
        return
      }

      await transport.handleRequest(req, res, req.body)
    } catch (error) {
      console.error('MCP request error:', error)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        })
      }
    }
  })

  // GET /mcp — SSE stream
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID')
      return
    }
    await transports[sessionId].handleRequest(req, res)
  })

  // DELETE /mcp — session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID')
      return
    }
    await transports[sessionId].handleRequest(req, res)
  })

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tempo MCP server listening on port ${PORT}`)
  })

  process.on('SIGINT', async () => {
    for (const sid in transports) {
      await transports[sid].close().catch(() => {})
      delete transports[sid]
    }
    process.exit(0)
  })
}
