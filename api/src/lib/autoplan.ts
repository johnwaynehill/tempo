/**
 * Server-side morning auto-plan.
 *
 * Picks 3–5 todos for the user's Today view by combining the same heuristic
 * scoring used in `src/lib/scoring.ts` (ported here so the server doesn't
 * depend on the frontend bundle) with an Anthropic AI ranking pass that
 * narrows the candidate pool to a coherent shortlist.
 *
 * Heuristic-only fallback ships if ANTHROPIC_API_KEY is unset or Anthropic
 * returns an error — the cron should never crash the API.
 */

import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

// --- Tunables ---

const TARGET_COUNT_MIN = 3
const TARGET_COUNT_MAX = 5
const CANDIDATE_POOL_SIZE = 12          // top-N heuristic candidates fed to the AI
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'
const ANTHROPIC_TIMEOUT_MS = 20_000

// Projects whose todos should never be suggested for Today *before* their due
// date (not urgent yet), but are guaranteed on it — and every day after, until
// they're done. Overdue is the case that matters most: a chore that slipped
// past its date is exactly the thing that must not quietly stop appearing on
// Today, or it never gets done. (Reschedule by editing the due date; anything
// still outstanding keeps showing up.) Case-insensitive, trimmed compare.
// Mirrors the same constant in src/lib/scoring.ts — extend both if more
// projects need this.
const DUE_DATE_GATED_PROJECTS = new Set(['chore'])

function isDueDateGatedProject(project: string | null): boolean {
  return project != null && DUE_DATE_GATED_PROJECTS.has(project.trim().toLowerCase())
}

// --- Types ---

type EnergyLevel = 'low' | 'medium_low' | 'medium' | 'high'

const ENERGY_ORDINAL: Record<EnergyLevel, number> = {
  low: 0,
  medium_low: 1,
  medium: 2,
  high: 3,
}

type TodoRow = typeof schema.todos.$inferSelect

// --- Timezone-safe date helpers ---
//
// `runAutoplanForUser` computes "today" in the user's configured IANA
// timezone (see below), but day-granularity comparisons here previously used
// dueDate.getFullYear()/.getMonth()/.getDate(), which resolve in the
// *server's* local timezone (UTC on Railway) — not the user's. That can shift
// which calendar day a due date "counts as" for several hours around each
// timezone's day boundary (e.g. a chore due "today" in Pacific time could
// still read as tomorrow on the UTC server). All day comparisons now go
// through these helpers so they're anchored to the user's timezone.

function localDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Whole days between two YYYY-MM-DD strings (b minus a). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / (1000 * 60 * 60 * 24))
}

// --- Heuristic scoring (mirror of src/lib/scoring.ts) ---

function dueDateUrgency(dueDateStr: string | null, todayDateStr: string): number {
  if (!dueDateStr) return 0.2
  const daysUntil = daysBetween(todayDateStr, dueDateStr)
  if (daysUntil < 0) return 1.0
  if (daysUntil === 0) return 1.0
  if (daysUntil === 1) return 0.7
  if (daysUntil <= 7) return 0.4
  return 0.1
}

function energyMatch(
  taskEnergy: EnergyLevel | null | undefined,
  currentEnergy: EnergyLevel | null | undefined,
): number {
  if (!taskEnergy || !currentEnergy) return 0.5
  const distance = Math.abs(ENERGY_ORDINAL[taskEnergy] - ENERGY_ORDINAL[currentEnergy])
  if (distance === 0) return 1.0
  if (distance === 1) return 0.5
  return 0.0
}

function staleness(createdAt: Date): number {
  const days = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  return Math.min(days / 30, 1.0)
}

function scoreTodo(
  todo: TodoRow,
  currentEnergy: EnergyLevel | null | undefined,
  todayDateStr: string,
  timezone: string,
): number {
  const dueDateStr = todo.dueDate ? localDateString(todo.dueDate, timezone) : null
  return (
    dueDateUrgency(dueDateStr, todayDateStr) * 40 +
    (todo.impact ?? 3) * 8 +
    energyMatch(todo.energyLevel as EnergyLevel | null, currentEnergy) * 25 +
    staleness(todo.createdAt) * 10
  )
}

// --- Candidate selection ---

interface CandidateSelection {
  /** Top-N scored candidates fed to the AI/heuristic picker. */
  candidates: TodoRow[]
  /**
   * DUE_DATE_GATED_PROJECTS todos that are due today or already overdue.
   * Always a subset of `eligible` (computed before the top-N truncation, so it
   * can never be dropped by the pool-size cap) — the caller adds these to the
   * final picks unconditionally, not just as candidates the AI/heuristic may
   * or may not choose. Due (or late) is a commitment, not a suggestion.
   */
  mandatory: TodoRow[]
}

/**
 * Pull eligible candidates from the user's todos. Mirrors the filter in
 * `suggestTodayTodos` on the frontend: skip done, today_pinned, inbox, and
 * deferred-not-yet-due. We INCLUDE backlog (which the frontend hook treats
 * as the same eligible set) — auto-plan is meant to fill an empty Today.
 *
 * Todos in a `DUE_DATE_GATED_PROJECTS` project (e.g. Chore) get an additional
 * hard gate: eligible only once their due date has arrived, in the user's
 * timezone. No due date, or a due date still in the future, excludes them from
 * candidacy entirely — they don't just score lower, they're never considered,
 * so they can't crowd out real priorities in the days leading up to their due
 * date. Once the date arrives they stay eligible while overdue, until they're
 * done. Every one that survives the gate is due or late, so they're also
 * returned as `mandatory` — see there.
 */
function selectCandidates(
  todos: TodoRow[],
  currentEnergy: EnergyLevel | null | undefined,
  todayDateStr: string,
  timezone: string,
): CandidateSelection {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const eligible = todos.filter((t) => {
    if (t.status === 'done' || t.status === 'today_pinned') return false
    if (t.status === 'inbox') return false
    if (t.status === 'deferred' && t.deferUntil && t.deferUntil > now) return false
    if (t.dismissedFromToday && t.dismissedFromToday >= today) return false

    if (isDueDateGatedProject(t.project)) {
      if (!t.dueDate) return false
      // Due today (0) or overdue (negative) passes; still upcoming does not.
      if (daysBetween(todayDateStr, localDateString(t.dueDate, timezone)) > 0) return false
    }

    return true
  })

  const candidates = eligible
    .map((todo) => ({ todo, score: scoreTodo(todo, currentEnergy, todayDateStr, timezone) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_POOL_SIZE)
    .map((s) => s.todo)

  // Oldest due date first, so the most overdue chore leads.
  const mandatory = eligible
    .filter((t) => isDueDateGatedProject(t.project))
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))

  return { candidates, mandatory }
}

// --- AI ranking ---

function serializeTodoForAI(t: TodoRow): string {
  const parts = [`id:"${t.id}"`, `"${t.title}"`]
  if (t.energyLevel) parts.push(`energy:${t.energyLevel}`)
  if (t.size) parts.push(`size:${t.size}`)
  if (t.impact != null) parts.push(`impact:${t.impact}`)
  if (t.estimatedMinutes) parts.push(`est:${t.estimatedMinutes}min`)
  if (t.dueDate) parts.push(`due:${t.dueDate.toISOString().split('T')[0]}`)
  if (t.project) parts.push(`proj:${t.project}`)
  return parts.join(' | ')
}

/**
 * Ask Anthropic to pick 3–5 todo IDs from the candidate pool. Returns an
 * ordered list of IDs, or null if the AI call fails (heuristic fallback
 * caller will use the top-N from the candidate pool instead).
 */
async function rankWithAI(
  candidates: TodoRow[],
  currentEnergy: EnergyLevel | null | undefined,
): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  if (candidates.length === 0) return []

  const todoList = candidates.map(serializeTodoForAI).join('\n')
  const system =
    `You are Tempo, an ADHD productivity assistant. Each morning you choose the ` +
    `3–5 tasks that should be on the user's Today view. Optimize for: a coherent ` +
    `start-of-day load (avoid all-large or all-tiny), energy match, due-date ` +
    `urgency, and momentum. Return ONLY valid JSON of the form ` +
    `{"todo_ids":["...","...","..."]}. Include 3 to 5 IDs from the candidate list. ` +
    `No prose, no markdown fences.`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 400,
        system,
        messages: [
          {
            role: 'user',
            content: `Current energy: ${currentEnergy ?? 'not set'}\nCandidates:\n${todoList}\n\nPick 3–5.`,
          },
        ],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      console.warn('[autoplan] Anthropic returned', res.status)
      return null
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] }
    const text = data.content?.find((c) => c.type === 'text')?.text?.trim()
    if (!text) return null

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned) as { todo_ids?: string[] }
    if (!Array.isArray(parsed.todo_ids)) return null

    const candidateIds = new Set(candidates.map((c) => c.id))
    const filtered = parsed.todo_ids.filter((id) => candidateIds.has(id))
    // Clamp to 3–5; AI sometimes returns fewer or more.
    if (filtered.length === 0) return null
    return filtered.slice(0, TARGET_COUNT_MAX)
  } catch (err) {
    console.warn('[autoplan] Anthropic call failed:', err)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// --- Main entry point ---

export interface AutoplanResult {
  userId: string
  pickedTodoIds: string[]
  source: 'ai' | 'heuristic' | 'noop'
  candidateCount: number
  todayDate: string  // YYYY-MM-DD in user's tz
}

/**
 * Run the auto-plan for a single user. Replaces (does NOT merge) the user's
 * Today view. Safe to call repeatedly — uses `autoplan_last_run_date` to
 * skip work if already run today in the user's timezone.
 *
 * Returns a result describing what happened. Throws on DB errors.
 */
export async function runAutoplanForUser(
  userId: string,
  timezone: string,
  opts: { force?: boolean } = {},
): Promise<AutoplanResult> {
  // Compute "today" in the user's timezone — Postgres date column expects YYYY-MM-DD.
  const todayDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  // Idempotency: skip if we already ran today (unless forced).
  const [prefs] = await db
    .select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.userId, userId))

  if (!opts.force && prefs?.autoplanLastRunDate === todayDate) {
    return {
      userId,
      pickedTodoIds: [],
      source: 'noop',
      candidateCount: 0,
      todayDate,
    }
  }

  // Load all todos for the user (we filter in JS to match frontend behavior).
  const todos = await db
    .select()
    .from(schema.todos)
    .where(eq(schema.todos.userId, userId))

  const currentEnergy = (prefs?.currentEnergy ?? null) as EnergyLevel | null
  const { candidates, mandatory } = selectCandidates(todos, currentEnergy, todayDate, timezone)

  let pickedIds: string[]
  let source: 'ai' | 'heuristic'

  if (candidates.length === 0) {
    // Nothing eligible — clear today and bail.
    pickedIds = []
    source = 'heuristic'
  } else {
    const aiPicks = await rankWithAI(candidates, currentEnergy)
    if (aiPicks && aiPicks.length >= 1) {
      pickedIds = aiPicks
      source = 'ai'
    } else {
      // Heuristic fallback: take top-N (clamped 3..5) from the scored pool.
      const targetCount = Math.min(
        Math.max(TARGET_COUNT_MIN, Math.min(candidates.length, TARGET_COUNT_MAX)),
        candidates.length,
      )
      pickedIds = candidates.slice(0, targetCount).map((c) => c.id)
      source = 'heuristic'
    }
  }

  // Mandatory due-or-overdue items (e.g. Chores) are never left out just
  // because the AI/heuristic pass didn't happen to choose them — a chore
  // that's due, or late, is a commitment, not a suggestion it's free to skip.
  // Added on top of the 3–5 target, not counted against it, so Today runs
  // over 5 items rather than dropping any of them. Order: mandatory first,
  // so they read as the non-negotiable part of the day.
  if (mandatory.length > 0) {
    const alreadyPicked = new Set(pickedIds)
    const additions = mandatory.map((t) => t.id).filter((id) => !alreadyPicked.has(id))
    pickedIds = [...additions, ...pickedIds]
  }

  // --- Replace Today ---
  //
  // Wipe whatever is currently in today_pinned by demoting back to backlog,
  // then promote the picks. We intentionally don't preserve the user's manual
  // picks — that's the requested behavior ("Replace whatever is currently in
  // Today — don't merge"). Manual replanning happens via /plan UI.
  await db
    .update(schema.todos)
    .set({ status: 'backlog' })
    .where(and(eq(schema.todos.userId, userId), eq(schema.todos.status, 'today_pinned')))

  if (pickedIds.length > 0) {
    await db
      .update(schema.todos)
      .set({ status: 'today_pinned' })
      .where(and(eq(schema.todos.userId, userId), inArray(schema.todos.id, pickedIds)))

    // Mirror the choice into today_sets (Today view also reads from there).
    await db
      .insert(schema.todaySets)
      .values({ userId, date: todayDate, todoIds: pickedIds })
      .onConflictDoUpdate({
        target: [schema.todaySets.userId, schema.todaySets.date],
        set: { todoIds: pickedIds },
      })
  }

  // Mark this run as done so duplicate cron triggers no-op.
  await db
    .insert(schema.userPreferences)
    .values({ userId, autoplanLastRunDate: todayDate })
    .onConflictDoUpdate({
      target: schema.userPreferences.userId,
      set: { autoplanLastRunDate: todayDate },
    })

  return {
    userId,
    pickedTodoIds: pickedIds,
    source,
    candidateCount: candidates.length,
    todayDate,
  }
}

/**
 * Run auto-plan for every opted-in user. Returns one result per user.
 * Per-user errors are caught and surfaced in the result so one bad user
 * doesn't abort the whole batch.
 */
export async function runAutoplanForAllOptedIn(
  opts: { force?: boolean } = {},
): Promise<(AutoplanResult | { userId: string; error: string })[]> {
  const optedIn = await db
    .select({
      userId: schema.userPreferences.userId,
      timezone: schema.userPreferences.autoplanTimezone,
    })
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.autoplanEnabled, true))

  const results: (AutoplanResult | { userId: string; error: string })[] = []
  for (const row of optedIn) {
    try {
      results.push(await runAutoplanForUser(row.userId, row.timezone, opts))
    } catch (err) {
      console.error(`[autoplan] user ${row.userId} failed:`, err)
      results.push({
        userId: row.userId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return results
}
