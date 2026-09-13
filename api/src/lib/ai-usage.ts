import { desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { costUsd, dailyCapUsd, localDate, nextLocalMidnight } from './ai-pricing.js'
import type { TokenUsage } from './ai-pricing.js'

const DEFAULT_TZ = 'America/Los_Angeles'

export interface SpendToday {
  date: string
  timezone: string
  spentUsd: number
  requests: number
  capUsd: number
  resetsAt: Date
  /** True when the cap is on and today's spend has reached it. */
  exceeded: boolean
}

export async function userTimezone(userId: string): Promise<string> {
  const [row] = await db
    .select({ tz: schema.userPreferences.autoplanTimezone })
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.userId, userId))
  return row?.tz || DEFAULT_TZ
}

export async function getSpendToday(userId: string, now: Date = new Date()): Promise<SpendToday> {
  const timezone = await userTimezone(userId)
  const date = localDate(timezone, now)
  const [row] = await db
    .select({ cost: schema.aiUsageDaily.costUsd, requests: schema.aiUsageDaily.requests })
    .from(schema.aiUsageDaily)
    .where(sql`${schema.aiUsageDaily.userId} = ${userId} and ${schema.aiUsageDaily.date} = ${date}`)
  const spentUsd = Number(row?.cost ?? 0)
  const capUsd = dailyCapUsd()
  return {
    date,
    timezone,
    spentUsd,
    requests: row?.requests ?? 0,
    capUsd,
    resetsAt: nextLocalMidnight(timezone, now),
    exceeded: capUsd > 0 && spentUsd >= capUsd,
  }
}

/** Add one call's tokens and cost to the user's row for `date`. Never throws. */
export async function recordUsage(userId: string, date: string, model: string, usage: TokenUsage): Promise<void> {
  const cost = costUsd(model, usage)
  const t = schema.aiUsageDaily
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  try {
    await db
      .insert(t)
      .values({
        userId,
        date,
        requests: 1,
        inputTokens: input,
        outputTokens: output,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        costUsd: cost.toFixed(6),
      })
      .onConflictDoUpdate({
        target: [t.userId, t.date],
        set: {
          requests: sql`${t.requests} + 1`,
          inputTokens: sql`${t.inputTokens} + ${input}`,
          outputTokens: sql`${t.outputTokens} + ${output}`,
          cacheReadTokens: sql`${t.cacheReadTokens} + ${cacheRead}`,
          cacheWriteTokens: sql`${t.cacheWriteTokens} + ${cacheWrite}`,
          costUsd: sql`${t.costUsd} + ${cost.toFixed(6)}::numeric`,
          updatedAt: new Date(),
        },
      })
  } catch (err) {
    console.error('[ai-usage] failed to record usage:', err)
  }
}

export interface UsageDay {
  date: string
  requests: number
  inputTokens: number
  outputTokens: number
  spentUsd: number
}

export async function usageHistory(userId: string, days = 7): Promise<UsageDay[]> {
  const t = schema.aiUsageDaily
  const rows = await db
    .select()
    .from(t)
    .where(eq(t.userId, userId))
    .orderBy(desc(t.date))
    .limit(days)
  return rows.map((r) => ({
    date: r.date,
    requests: r.requests,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    spentUsd: Number(r.costUsd),
  }))
}
