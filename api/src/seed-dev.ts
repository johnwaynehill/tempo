/**
 * Seed script for dev-test-user.
 * Run with: cd api && npx tsx src/seed-dev.ts
 *
 * Populates the dev test user with sample data so authenticated pages
 * aren't empty when using the dev auth bypass (VITE_DEV_AUTH=true).
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { eq } from 'drizzle-orm'
import * as schema from './db/schema.js'

const USER_ID = 'dev-test-user'

async function seed() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool, { schema })

  console.log('Seeding dev-test-user data...')

  // Clean existing dev user data
  await db.delete(schema.todos).where(eq(schema.todos.userId, USER_ID))
  await db.delete(schema.notes).where(eq(schema.notes.userId, USER_ID))
  await db.delete(schema.habits).where(eq(schema.habits.userId, USER_ID))
  await db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.userId, USER_ID))
  await db.delete(schema.projects).where(eq(schema.projects.userId, USER_ID))
  await db.delete(schema.playlists).where(eq(schema.playlists.userId, USER_ID))
  await db.delete(schema.moodEntries).where(eq(schema.moodEntries.userId, USER_ID))
  await db.delete(schema.userPreferences).where(eq(schema.userPreferences.userId, USER_ID))

  // Projects
  const [projectWork, projectHealth] = await db.insert(schema.projects).values([
    { userId: USER_ID, name: 'Work' },
    { userId: USER_ID, name: 'Health' },
  ]).returning()

  // Todos — mix of statuses
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todos = await db.insert(schema.todos).values([
    { userId: USER_ID, title: 'Review pull requests', status: 'today_pinned', size: 'medium', project: projectWork.name, energyLevel: 'medium' },
    { userId: USER_ID, title: 'Fix login redirect bug', status: 'today_pinned', size: 'small', project: projectWork.name, energyLevel: 'high' },
    { userId: USER_ID, title: 'Go for a 30 min walk', status: 'today_pinned', size: 'small', project: projectHealth.name, energyLevel: 'low' },
    { userId: USER_ID, title: 'Write API documentation', status: 'backlog', size: 'large', project: projectWork.name, energyLevel: 'high' },
    { userId: USER_ID, title: 'Plan grocery list', status: 'inbox', size: 'small' },
    { userId: USER_ID, title: 'Research new database options', status: 'backlog', size: 'large', project: projectWork.name, energyLevel: 'high' },
    { userId: USER_ID, title: 'Schedule dentist appointment', status: 'inbox', size: 'small', project: projectHealth.name },
    { userId: USER_ID, title: 'Refactor auth middleware', status: 'done', size: 'medium', project: projectWork.name, completedAt: new Date(now.getTime() - 86400000) },
  ]).returning()

  // Today set — pin the today_pinned todos
  const todayStr = now.toISOString().split('T')[0]
  const todayPinnedIds = todos.filter(t => t.status === 'today_pinned').map(t => t.id)
  await db.insert(schema.todaySets).values({
    userId: USER_ID,
    date: todayStr,
    todoIds: todayPinnedIds,
  })

  // Notes
  await db.insert(schema.notes).values([
    { userId: USER_ID, title: 'Meeting notes — sprint planning', content: '## Sprint Goals\n\n- Ship auth bypass for dev testing\n- Fix Today view layout\n- Add mood tracking insights\n\n## Action Items\n- [ ] Review open PRs by EOD\n- [ ] Update project board', project: projectWork.name },
    { userId: USER_ID, title: 'Workout routine', content: '## Weekly Plan\n\n**Mon/Wed/Fri**: Strength training (45 min)\n**Tue/Thu**: Cardio + stretching (30 min)\n**Sat**: Long walk or hike\n**Sun**: Rest', project: projectHealth.name },
  ])

  // Habits
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  await db.insert(schema.habits).values([
    { userId: USER_ID, name: 'Morning walk', frequency: 'daily', completions: { [yesterdayStr]: true } },
    { userId: USER_ID, name: 'Read for 20 min', frequency: 'daily', completions: {} },
    { userId: USER_ID, name: 'Drink 8 glasses of water', frequency: 'daily', completions: { [todayStr]: true, [yesterdayStr]: true } },
    { userId: USER_ID, name: 'Weekly review', frequency: 'weekly', completions: {} },
  ])

  // Calendar events — today and tomorrow
  const todayAt = (hours: number, minutes = 0) => {
    const d = new Date(now)
    d.setHours(hours, minutes, 0, 0)
    return d
  }
  const tomorrowAt = (hours: number, minutes = 0) => {
    const d = new Date(tomorrow)
    d.setHours(hours, minutes, 0, 0)
    return d
  }

  await db.insert(schema.calendarEvents).values([
    { userId: USER_ID, title: 'Standup', startTime: todayAt(9, 30), endTime: todayAt(9, 45), color: 'primary' },
    { userId: USER_ID, title: 'Focus time — deep work', startTime: todayAt(10), endTime: todayAt(12), color: 'tertiary' },
    { userId: USER_ID, title: 'Lunch break', startTime: todayAt(12), endTime: todayAt(13), color: 'neutral' },
    { userId: USER_ID, title: '1:1 with manager', startTime: tomorrowAt(14), endTime: tomorrowAt(14, 30), color: 'primary' },
  ])

  // Mood entries — last few days
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(10, 0, 0, 0)
    await db.insert(schema.moodEntries).values({
      userId: USER_ID,
      value: 40 + Math.round(Math.random() * 40), // 40-80 range
      note: i === 0 ? 'Feeling productive today' : undefined,
      createdAt: d,
    })
  }

  // Preferences
  await db.insert(schema.userPreferences).values({
    userId: USER_ID,
    currentEnergy: 'medium',
    theme: 'system',
    notificationsEnabled: false,
  })

  console.log('Done! Dev user seeded with:')
  console.log(`  - 2 projects`)
  console.log(`  - ${todos.length} todos (3 pinned today)`)
  console.log(`  - 2 notes`)
  console.log(`  - 4 habits`)
  console.log(`  - 4 calendar events`)
  console.log(`  - 6 mood entries`)

  await pool.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
