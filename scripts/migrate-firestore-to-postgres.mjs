#!/usr/bin/env node
/**
 * One-time migration: Firestore → Postgres (Railway)
 *
 * Usage:
 *   node scripts/migrate-firestore-to-postgres.mjs
 *
 * Env vars (or edit the constants below):
 *   GOOGLE_APPLICATION_CREDENTIALS — path to Firebase service account JSON
 *   DATABASE_URL                   — Postgres connection string
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { Client } = require('pg')

// Firebase Admin SDK (ESM-compatible import)
const admin = require('firebase-admin')

// --- Config ---
const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

const SA_KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve(PROJECT_ROOT, 'tempo-b11a9-firebase-adminsdk-fbsvc-edb6109d7d.json')

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:ZCQITSLGLemKvOZDZGibMUsjpwbLzxFS@gondola.proxy.rlwy.net:40575/railway'

// --- Init Firebase ---
const serviceAccount = JSON.parse(readFileSync(SA_KEY_PATH, 'utf-8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const firestore = admin.firestore()

// --- Init Postgres ---
const pg = new Client(DATABASE_URL)

// --- Helpers ---
function tsToISO(ts) {
  if (!ts) return null
  if (ts.toDate) return ts.toDate().toISOString()
  if (ts instanceof Date) return ts.toISOString()
  return null
}

function jsonOrNull(val) {
  if (val === undefined || val === null) return null
  return JSON.stringify(val)
}

const stats = {}
function track(table, count) {
  stats[table] = (stats[table] || 0) + count
}

// --- Migration functions ---

async function migrateUser(uid) {
  console.log(`\n--- Migrating user: ${uid} ---`)
  const userRef = firestore.collection('users').doc(uid)

  // Build ID mappings for foreign keys
  const todoIdMap = new Map()  // firestore_id -> postgres UUID
  const noteIdMap = new Map()

  // 1. Todos (first pass — no foreign keys yet)
  const todos = await userRef.collection('todos').get()
  for (const doc of todos.docs) {
    const d = doc.data()
    const result = await pg.query(
      `INSERT INTO todos (user_id, firestore_id, title, status, progress, project, size, impact,
        energy_level, due_date, supports, defer_until, reminder_at, dismissed_from_today,
        recurrence, created_at, updated_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        uid, doc.id, d.title, d.status || 'inbox', d.progress ?? null, d.project ?? null,
        d.size ?? null, d.impact ?? null, d.energy_level ?? null,
        tsToISO(d.due_date), d.supports ?? null,
        tsToISO(d.defer_until), tsToISO(d.reminder_at), tsToISO(d.dismissed_from_today),
        jsonOrNull(d.recurrence),
        tsToISO(d.created_at) || new Date().toISOString(),
        tsToISO(d.updated_at) || new Date().toISOString(),
        tsToISO(d.completed_at),
      ]
    )
    todoIdMap.set(doc.id, result.rows[0].id)
  }
  track('todos', todos.size)
  console.log(`  todos: ${todos.size}`)

  // 2. Notes
  const notes = await userRef.collection('notes').get()
  for (const doc of notes.docs) {
    const d = doc.data()
    const linkedTodoUUID = d.linked_todo_id ? todoIdMap.get(d.linked_todo_id) || null : null

    // Remap inline_todo_map values from firestore IDs to postgres UUIDs
    let inlineTodoMap = null
    if (d.inline_todo_map) {
      const remapped = {}
      for (const [checkboxId, firestoreTodoId] of Object.entries(d.inline_todo_map)) {
        remapped[checkboxId] = todoIdMap.get(firestoreTodoId) || firestoreTodoId
      }
      inlineTodoMap = JSON.stringify(remapped)
    }

    const result = await pg.query(
      `INSERT INTO notes (user_id, firestore_id, title, content, linked_todo_id, inline_todo_map,
        created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        uid, doc.id, d.title, d.content ?? '',
        linkedTodoUUID, inlineTodoMap,
        tsToISO(d.created_at) || new Date().toISOString(),
        tsToISO(d.updated_at) || new Date().toISOString(),
      ]
    )
    noteIdMap.set(doc.id, result.rows[0].id)
  }
  track('notes', notes.size)
  console.log(`  notes: ${notes.size}`)

  // 3. Back-fill todo foreign keys (note_id, recurrence_parent_id)
  for (const doc of todos.docs) {
    const d = doc.data()
    const pgId = todoIdMap.get(doc.id)
    const noteUUID = d.note_id ? noteIdMap.get(d.note_id) || null : null
    const parentUUID = d.recurrence_parent_id ? todoIdMap.get(d.recurrence_parent_id) || null : null

    if (noteUUID || parentUUID) {
      await pg.query(
        `UPDATE todos SET note_id = COALESCE($1, note_id), recurrence_parent_id = COALESCE($2, recurrence_parent_id)
         WHERE id = $3`,
        [noteUUID, parentUUID, pgId]
      )
    }
  }

  // 4. Habits
  const habits = await userRef.collection('habits').get()
  for (const doc of habits.docs) {
    const d = doc.data()
    await pg.query(
      `INSERT INTO habits (user_id, firestore_id, name, description, frequency, archived, completions,
        created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        uid, doc.id, d.name, d.description ?? null, d.frequency || 'daily',
        d.archived ?? false, JSON.stringify(d.completions ?? {}),
        tsToISO(d.created_at) || new Date().toISOString(),
        tsToISO(d.updated_at) || new Date().toISOString(),
      ]
    )
  }
  track('habits', habits.size)
  console.log(`  habits: ${habits.size}`)

  // 5. Calendar Events
  const events = await userRef.collection('events').get()
  for (const doc of events.docs) {
    const d = doc.data()
    await pg.query(
      `INSERT INTO calendar_events (user_id, firestore_id, title, start_time, end_time, all_day,
        description, location, color, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        uid, doc.id, d.title,
        tsToISO(d.start_time) || new Date().toISOString(),
        tsToISO(d.end_time) || new Date().toISOString(),
        d.all_day ?? false,
        d.description ?? null, d.location ?? null, d.color ?? null,
        tsToISO(d.created_at) || new Date().toISOString(),
        tsToISO(d.updated_at) || new Date().toISOString(),
      ]
    )
  }
  track('calendar_events', events.size)
  console.log(`  events: ${events.size}`)

  // 6. Conversations
  const convos = await userRef.collection('conversations').get()
  for (const doc of convos.docs) {
    const d = doc.data()
    const todoUUID = d.todoId ? todoIdMap.get(d.todoId) || null : null

    let displayMessages = '[]'
    try {
      displayMessages = typeof d.displayMessages === 'string' ? d.displayMessages : JSON.stringify(d.displayMessages ?? [])
    } catch { /* ignore */ }

    let apiMessages = '[]'
    try {
      apiMessages = typeof d.apiMessages === 'string' ? d.apiMessages : JSON.stringify(d.apiMessages ?? [])
    } catch { /* ignore */ }

    await pg.query(
      `INSERT INTO conversations (user_id, firestore_id, mode, todo_id, style, title,
        display_messages, api_messages, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        uid, doc.id, d.mode || 'today', todoUUID, d.style ?? null, d.title || 'Untitled',
        displayMessages, apiMessages,
        tsToISO(d.created_at) || new Date().toISOString(),
        tsToISO(d.updated_at) || new Date().toISOString(),
      ]
    )
  }
  track('conversations', convos.size)
  console.log(`  conversations: ${convos.size}`)

  // 7. User Preferences
  const prefsDoc = await userRef.collection('settings').doc('preferences').get()
  if (prefsDoc.exists) {
    const d = prefsDoc.data()
    await pg.query(
      `INSERT INTO user_preferences (user_id, current_energy, theme, notifications_enabled)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET current_energy=$2, theme=$3, notifications_enabled=$4`,
      [uid, d.current_energy ?? null, d.theme || 'system', d.notifications_enabled ?? false]
    )
    track('user_preferences', 1)
    console.log(`  preferences: migrated`)
  }

  // 8. Today Set
  const todayDoc = await userRef.collection('settings').doc('today_set').get()
  if (todayDoc.exists) {
    const d = todayDoc.data()
    if (d.date) {
      const pgTodoIds = (d.todo_ids || [])
        .map(fid => todoIdMap.get(fid))
        .filter(Boolean)

      await pg.query(
        `INSERT INTO today_sets (user_id, date, todo_ids)
         VALUES ($1,$2,$3)
         ON CONFLICT (user_id, date) DO UPDATE SET todo_ids=$3`,
        [uid, d.date, pgTodoIds]
      )
      track('today_sets', 1)
      console.log(`  today_set: ${d.date} (${pgTodoIds.length} todos)`)
    }
  }

  // 9. Weekly Reviews
  const reviews = await userRef.collection('reviews').get()
  for (const doc of reviews.docs) {
    const d = doc.data()
    await pg.query(
      `INSERT INTO weekly_reviews (id, user_id, reflection, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, id) DO NOTHING`,
      [
        doc.id, uid, d.reflection ?? '',
        tsToISO(d.created_at) || new Date().toISOString(),
        tsToISO(d.updated_at) || new Date().toISOString(),
      ]
    )
  }
  track('weekly_reviews', reviews.size)
  console.log(`  reviews: ${reviews.size}`)
}

// --- Main ---

async function main() {
  console.log('Connecting to Postgres...')
  await pg.connect()
  console.log('Connected.\n')

  // Discover all users in Firestore (includes docs that only have subcollections)
  console.log('Discovering users...')
  const userDocRefs = await firestore.collection('users').listDocuments()
  const userIds = userDocRefs.map(d => d.id)
  console.log(`Found ${userIds.length} user(s): ${userIds.join(', ')}`)

  for (const uid of userIds) {
    await migrateUser(uid)
  }

  console.log('\n=== Migration Complete ===')
  console.log(JSON.stringify(stats, null, 2))

  await pg.end()
  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
