import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import admin from 'firebase-admin'
import { authenticate } from './middleware/auth.js'
import { ipRateLimit, userRateLimit, anthropicRateLimit } from './middleware/rate-limit.js'
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

// IP-based limit runs before auth to blunt brute-force attempts on API keys.
// User-based limit runs after auth for higher-signal per-account throttling.
app.use('/api', ipRateLimit, authenticate, userRateLimit)

app.use('/api/todos', todosRouter)
app.use('/api/notes', notesRouter)
app.use('/api/habits', habitsRouter)
app.use('/api/events', eventsRouter)
app.use('/api/preferences', preferencesRouter)
app.use('/api/today-set', todaySetRouter)
app.use('/api/reviews', reviewsRouter)
app.use('/api/api-keys', apiKeysRouter)
app.use('/api/anthropic', anthropicRateLimit, anthropicRouter)
app.use('/api/conversations', conversationsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/playlists', playlistsRouter)
app.use('/api/mood', moodRouter)
app.use('/api/mcp-oauth', mcpOauthRouter)
app.use('/api/auth', authRouter)

app.listen(port, '0.0.0.0', () => {
  console.log(`Tempo API running on port ${port}`)
})
