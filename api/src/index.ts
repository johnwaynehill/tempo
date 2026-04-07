import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import admin from 'firebase-admin'
import { authenticate } from './middleware/auth.js'
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

// Init Firebase Admin (for token verification)
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID,
})

const app = express()
const port = parseInt(process.env.PORT || '3001', 10)

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

// All API routes require auth
app.use('/api', authenticate)

app.use('/api/todos', todosRouter)
app.use('/api/notes', notesRouter)
app.use('/api/habits', habitsRouter)
app.use('/api/events', eventsRouter)
app.use('/api/preferences', preferencesRouter)
app.use('/api/today-set', todaySetRouter)
app.use('/api/reviews', reviewsRouter)
app.use('/api/api-keys', apiKeysRouter)
app.use('/api/anthropic', anthropicRouter)
app.use('/api/conversations', conversationsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/playlists', playlistsRouter)

app.listen(port, '0.0.0.0', () => {
  console.log(`Tempo API running on port ${port}`)
})
