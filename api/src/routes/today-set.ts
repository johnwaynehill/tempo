import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { generateTodaySet } from '../lib/autoplan.js'
import { userTimezone } from '../lib/ai-usage.js'

/** The body-date middleware may have turned "YYYY-MM-DD" into a Date; get the string back. */
function dateParam(value: unknown): string | undefined {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return undefined
}

const router = Router()

// Get today set for a specific date (defaults to today)
router.get('/', async (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10)
  const [row] = await db.select().from(schema.todaySets)
    .where(and(eq(schema.todaySets.userId, req.userId!), eq(schema.todaySets.date, date)))

  // `exists` lets clients tell "no set yet today" (generate one) apart from
  // "the set is empty" (the user dismissed everything) — both have todoIds: [].
  res.json(row ? { ...row, exists: true } : { userId: req.userId, date, todoIds: [], exists: false })
})

// Set/update today set
router.put('/', async (req, res) => {
  const { date, todoIds } = req.body as { date: string; todoIds: string[] }
  const [row] = await db
    .insert(schema.todaySets)
    .values({ userId: req.userId!, date, todoIds })
    .onConflictDoUpdate({
      target: [schema.todaySets.userId, schema.todaySets.date],
      set: { todoIds },
    })
    .returning()

  res.json(row)
})

// Generate (or regenerate) the suggestion set for a day using the server-side
// scoring. Body: { date?: "YYYY-MM-DD" } — defaults to today in the user's
// timezone. Does not change any todo's status.
router.post('/generate', async (req, res) => {
  const date = dateParam((req.body as { date?: unknown } | undefined)?.date)
  const timezone = await userTimezone(req.userId!)
  const row = await generateTodaySet(req.userId!, timezone, date)
  res.json(row)
})

export default router
