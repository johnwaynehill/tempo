#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { createServer } from './server.js'

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

  const PORT = parseInt(process.env.PORT || '3001', 10)
  const API_KEY = process.env.TEMPO_API_KEY || ''

  const app = createMcpExpressApp({ host: '0.0.0.0' })

  // Auth middleware — reuse the same API key as the Tempo API
  app.use('/mcp', (req, res, next) => {
    const key = req.headers['x-api-key'] as string | undefined
    if (!key || key !== API_KEY) {
      res.status(401).json({ error: 'Unauthorized — provide X-API-Key header' })
      return
    }
    next()
  })

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'tempo-mcp' })
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

        const server = createServer()
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
