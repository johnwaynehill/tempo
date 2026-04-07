import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core'

// --- Enums ---

export const energyLevelEnum = pgEnum('energy_level', ['low', 'medium_low', 'medium', 'high'])
export const todoStatusEnum = pgEnum('todo_status', ['inbox', 'today_pinned', 'backlog', 'deferred', 'done'])
export const todoSizeEnum = pgEnum('todo_size', ['small', 'medium', 'large'])
export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', ['daily', 'weekly', 'monthly'])
export const eventColorEnum = pgEnum('event_color', ['primary', 'tertiary', 'error', 'neutral'])
export const themePreferenceEnum = pgEnum('theme_preference', ['light', 'dark', 'system'])

// --- Todos ---

export const todos = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  firestoreId: text('firestore_id'),
  title: text('title').notNull(),
  status: todoStatusEnum('status').notNull().default('inbox'),
  progress: integer('progress'),
  project: text('project'),
  size: todoSizeEnum('size'),
  impact: integer('impact'),
  energyLevel: energyLevelEnum('energy_level'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  supports: text('supports'),
  noteId: uuid('note_id'),
  deferUntil: timestamp('defer_until', { withTimezone: true }),
  reminderAt: timestamp('reminder_at', { withTimezone: true }),
  dismissedFromToday: timestamp('dismissed_from_today', { withTimezone: true }),
  estimatedMinutes: integer('estimated_minutes'),
  recurrence: jsonb('recurrence'),
  recurrenceParentId: uuid('recurrence_parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

// --- Notes ---

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  firestoreId: text('firestore_id'),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  project: text('project'),
  linkedTodoId: uuid('linked_todo_id'),
  inlineTodoMap: jsonb('inline_todo_map'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// --- Projects ---

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.userId, table.name),
])

// --- Note ↔ Project join table ---

export const noteProjects = pgTable('note_projects', {
  noteId: uuid('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.noteId, table.projectId] }),
])

// --- Habits ---

export const habits = pgTable('habits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  firestoreId: text('firestore_id'),
  name: text('name').notNull(),
  description: text('description'),
  frequency: text('frequency').notNull().default('daily'),
  archived: boolean('archived').notNull().default(false),
  completions: jsonb('completions').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// --- Calendar Events ---

export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  firestoreId: text('firestore_id'),
  title: text('title').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  allDay: boolean('all_day').notNull().default(false),
  description: text('description'),
  location: text('location'),
  color: eventColorEnum('color'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// --- Conversations ---

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  firestoreId: text('firestore_id'),
  mode: text('mode').notNull(),
  todoId: uuid('todo_id'),
  style: text('style'),
  title: text('title').notNull(),
  displayMessages: jsonb('display_messages').notNull().default([]),
  apiMessages: jsonb('api_messages').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// --- User Preferences ---

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id').primaryKey(),
  currentEnergy: energyLevelEnum('current_energy'),
  theme: themePreferenceEnum('theme').notNull().default('system'),
  notificationsEnabled: boolean('notifications_enabled').notNull().default(false),
  adaptiveTheme: boolean('adaptive_theme').notNull().default(false),
})

// --- Today Sets ---

export const todaySets = pgTable('today_sets', {
  userId: text('user_id').notNull(),
  date: date('date').notNull(),
  todoIds: uuid('todo_ids').array().notNull().default([]),
}, (table) => [
  primaryKey({ columns: [table.userId, table.date] }),
])

// --- Weekly Reviews ---

export const weeklyReviews = pgTable('weekly_reviews', {
  id: text('id').notNull(),
  userId: text('user_id').notNull(),
  reflection: text('reflection').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.id] }),
])

// --- Playlists (Routine Templates) ---

export const playlists = pgTable('playlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const playlistItems = pgTable('playlist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  playlistId: uuid('playlist_id').notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  size: todoSizeEnum('size'),
  energyLevel: energyLevelEnum('energy_level'),
  estimatedMinutes: integer('estimated_minutes'),
  project: text('project'),
})

// --- API Keys ---

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  name: text('name').notNull().default('Default'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
})
