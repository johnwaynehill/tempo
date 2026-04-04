import 'dotenv/config'
import express from 'express'
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

// Init Firebase Admin (for token verification)
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID,
})

const app = express()
const port = parseInt(process.env.PORT || '3001', 10)

app.use(express.json())

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

app.listen(port, '0.0.0.0', () => {
  console.log(`Tempo API running on port ${port}`)
})
