import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import admin from 'firebase-admin'
import { authenticate } from './middleware/auth.js'
import { ipRateLimit, userRateLimit, anthropicRateLimit } from './middleware/rate-limit.js'
import { requireScope, requireMethodScope, requireFirebaseAuth } from './middleware/scopes.js'
import todosRouter from './routes/todos.js'
import notesRouter from './routes/notes.js'
import habitsRouter from './routes/habits.js'
import eventsRouter from './routes/events.js'
import preferencesRouter from './routes/preferences.js'
import todaySetRouter from './routes/today-set.js'
import reviewsRouter from './routes/reviews.js'
import apiKeysRouter from './routes/api-keys.js'
import anthropicRouter from './routes/anthropic.js'
import conversationsRouter from './routes/conversations.js'
import projectsRouter from './routes/projects.js'
import playlistsRouter from './routes/playlists.js'
import moodRouter from './routes/mood.js'
import mcpOauthRouter from './routes/mcp-oauth.js'
import authRouter from './routes/auth.js'
import autoplanRouter from './routes/autoplan.js'
import googleCalendarRouter, { googleCalendarCallbackRouter } from './routes/google-calendar.js'

// Init Firebase Admin (for token verification + user lookups)
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
const saPrivateKey = process.env.FIREBASE_SA_PRIVATE_KEY
const saClientEmail = process.env.FIREBASE_SA_CLIENT_EMAIL
const saProjectId = process.env.FIREBASE_SA_PROJECT_ID || process.env.FIREBASE_PROJECT_ID

admin.initializeApp(
  serviceAccount
    ? { credential: admin.credential.cert(JSON.parse(serviceAccount)) }
    : saPrivateKey
      ? { credential: admin.credential.cert({
          projectId: saProjectId,
          clientEmail: saClientEmail,
          privateKey: saPrivateKey.replace(/\\n/g, '\n'),
        } as admin.ServiceAccount) }
      : { projectId: process.env.FIREBASE_PROJECT_ID }
)

const app = express()
const port = parseInt(process.env.PORT || '3001', 10)

// Trust Railway's proxy so req.ip reflects the real client, not the edge proxy.
// Required for IP-based rate limiting to work correctly behind a reverse proxy.
app.set('trust proxy', 1)

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://tempo.designbyjohnwayne.com',
    /\.railway\.app$/,
    /\.web\.app$/,
  ],
  credentials: true,
}))
app.use(express.json())

// Parse ISO date strings in request bodies to Date objects (Drizzle requires Date, not strings)
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
        req.body[key] = new Date(value.includes('T') ? value : value + 'T00:00:00')
      }
    }
  }
  next()
})

// Health check (unauthenticated)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Internal cron endpoint — runs BEFORE the global `/api` auth chain because
// cron triggers can't sign in as a Firebase user or hold an API key. Auth is
// handled inside the router via a shared-secret header (AUTOPLAN_SECRET).
// IP rate-limit still applies to blunt brute-forcing the secret.
app.use('/api/internal/autoplan', ipRateLimit, autoplanRouter)

// Google OAuth callback — Google redirects the browser here with no auth
// header, so it must sit OUTSIDE the `/api` auth chain. The one-time `state`
// param ties the callback back to the user who initiated the connect flow.
// IP rate-limit still applies to blunt brute-forcing the state value.
app.use('/api/google-calendar/callback', ipRateLimit, googleCalendarCallbackRouter)

// IP-based limit runs before auth to blunt brute-force attempts on API keys.
// User-based limit runs after auth for higher-signal per-account throttling.
app.use('/api', ipRateLimit, authenticate, userRateLimit)

// Resource routers — GET requires 'read', writes require 'write'.
app.use('/api/todos', requireMethodScope, todosRouter)
app.use('/api/notes', requireMethodScope, notesRouter)
app.use('/api/habits', requireMethodScope, habitsRouter)
app.use('/api/events', requireMethodScope, eventsRouter)
app.use('/api/preferences', requireMethodScope, preferencesRouter)
app.use('/api/today-set', requireMethodScope, todaySetRouter)
app.use('/api/reviews', requireMethodScope, reviewsRouter)
app.use('/api/conversations', requireMethodScope, conversationsRouter)
app.use('/api/projects', requireMethodScope, projectsRouter)
app.use('/api/playlists', requireMethodScope, playlistsRouter)
app.use('/api/mood', requireMethodScope, moodRouter)
app.use('/api/google-calendar', requireMethodScope, googleCalendarRouter)
app.use('/api/mcp-oauth', requireMethodScope, mcpOauthRouter)
app.use('/api/auth', requireMethodScope, authRouter)

// Anthropic proxy is gated on the 'ai' scope (separate from read/write because it spends money).
app.use('/api/anthropic', requireScope('ai'), anthropicRateLimit, anthropicRouter)

// API-key management is privileged — only the user (via Firebase auth) can mint or revoke keys.
// This prevents a 'write'-scoped key from minting an 'ai' key for itself.
app.use('/api/api-keys', requireFirebaseAuth, apiKeysRouter)

app.listen(port, '0.0.0.0', () => {
  console.log(`Tempo API running on port ${port}`)
})
