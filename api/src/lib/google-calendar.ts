/**
 * Google Calendar sync engine (Phase 2).
 *
 * One-way: mirrors the **primary** calendar of each Google account the user has
 * connected into `calendar_events` as read-only `source='google'` rows (tagged
 * with the account's `connection_id`), over a rolling window of −7 to +90 days.
 *
 * Strategy: each run does a full re-list of the window (no sync token) and
 * reconciles — upsert everything returned, then prune any of that account's
 * rows that weren't returned (covers deletions, cancellations, and
 * events that have aged out of the window). With a small window and a
 * twice-daily cadence this is simpler and more robust than incremental
 * sync-token bookkeeping, and it's naturally idempotent.
 */

import { and, asc, eq, notInArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { encrypt, decrypt } from './crypto.js'
import { refreshAccessToken } from './google-oauth.js'

// Rolling sync window.
const WINDOW_PAST_DAYS = 7
const WINDOW_FUTURE_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

// Refresh the access token if it expires within this buffer.
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000

const CALENDAR_EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events'

type ConnectionRow = typeof schema.googleCalendarConnections.$inferSelect

export interface AccountSyncResult {
  connectionId: string
  email: string | null
  status: 'ok' | 'disabled' | 'error'
  upserted: number
  pruned: number
  error?: string
}

export interface SyncResult {
  userId: string
  /** 'ok' when at least one account synced; per-account detail is in `accounts`. */
  status: 'ok' | 'not_connected' | 'disabled'
  upserted: number
  pruned: number
  accounts: AccountSyncResult[]
}

// --- Google event shape (only the fields we use) ---

interface GoogleEvent {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string
  etag?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

// --- Token handling ---

/**
 * Returns a valid access token for the connection, refreshing (and persisting
 * the new token) if the stored one is expired or about to expire.
 */
async function getFreshAccessToken(conn: ConnectionRow): Promise<string> {
  const expiresSoon =
    conn.tokenExpiresAt.getTime() < Date.now() + TOKEN_REFRESH_BUFFER_MS
  if (!expiresSoon) return decrypt(conn.accessTokenEnc)

  const refreshed = await refreshAccessToken(decrypt(conn.refreshTokenEnc))
  await db
    .update(schema.googleCalendarConnections)
    .set({
      accessTokenEnc: encrypt(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
      scope: refreshed.scope,
      updatedAt: new Date(),
    })
    .where(eq(schema.googleCalendarConnections.id, conn.id))
  return refreshed.accessToken
}

// --- Google Calendar API ---

/** Lists all events on the primary calendar within [timeMin, timeMax]. */
async function listPrimaryEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEvent[]> {
  const events: GoogleEvent[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      singleEvents: 'true',       // expand recurring events into instances
      orderBy: 'startTime',
      maxResults: '2500',
      timeMin,
      timeMax,
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`${CALENDAR_EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      throw new Error(`Google events.list failed: ${res.status} ${await res.text()}`)
    }
    const json = await res.json() as { items?: GoogleEvent[]; nextPageToken?: string }
    if (json.items) events.push(...json.items)
    pageToken = json.nextPageToken
  } while (pageToken)
  return events
}

// --- Mapping ---

interface MappedEvent {
  externalId: string
  title: string
  startTime: Date
  endTime: Date
  allDay: boolean
  description: string | null
  location: string | null
  etag: string | null
}

function mapEvent(e: GoogleEvent): MappedEvent {
  // All-day events use `date` (no time); timed events use `dateTime`.
  //
  // For all-day events we anchor at **noon UTC**. Google sends a bare date with
  // no timezone; parsing it as midnight lands on 00:00 UTC on this (UTC) server,
  // which the frontend — bucketing/displaying by the viewer's LOCAL date — then
  // renders a day early for any negative-offset (Americas) timezone. Noon UTC
  // keeps the local calendar date correct from UTC-12 through UTC+11.
  const allDay = Boolean(e.start?.date)
  const start = allDay ? new Date(`${e.start!.date}T12:00:00Z`) : new Date(e.start!.dateTime!)
  const end = allDay ? new Date(`${e.end!.date}T12:00:00Z`) : new Date(e.end!.dateTime!)
  return {
    externalId: e.id,
    title: e.summary?.trim() || '(no title)',
    startTime: start,
    endTime: end,
    allDay,
    description: e.description ?? null,
    location: e.location ?? null,
    etag: e.etag ?? null,
  }
}

// --- Sync ---

/**
 * Syncs one connected Google account's primary calendar into `calendar_events`.
 * Records `last_synced_at` / `last_sync_error` on the connection. Throws on
 * failure (after recording the error).
 */
async function syncConnection(conn: ConnectionRow): Promise<{ upserted: number; pruned: number }> {
  try {
    const accessToken = await getFreshAccessToken(conn)
    const now = Date.now()
    const timeMin = new Date(now - WINDOW_PAST_DAYS * DAY_MS).toISOString()
    const timeMax = new Date(now + WINDOW_FUTURE_DAYS * DAY_MS).toISOString()

    const raw = await listPrimaryEvents(accessToken, timeMin, timeMax)
    const mapped = raw
      .filter((e) => e.status !== 'cancelled' && (e.start?.date || e.start?.dateTime))
      .map(mapEvent)

    // Upsert each event by (user_id, connection_id, external_id).
    for (const m of mapped) {
      const values = {
        title: m.title,
        startTime: m.startTime,
        endTime: m.endTime,
        allDay: m.allDay,
        description: m.description,
        location: m.location,
        etag: m.etag,
        updatedAt: new Date(),
      }
      await db
        .insert(schema.calendarEvents)
        .values({ userId: conn.userId, source: 'google', connectionId: conn.id, externalId: m.externalId, ...values })
        .onConflictDoUpdate({
          target: [schema.calendarEvents.userId, schema.calendarEvents.connectionId, schema.calendarEvents.externalId],
          set: values,
        })
    }

    // Prune this account's rows not in the current window/result set — covers
    // deletions, cancellations, and events that aged out of the window.
    const keepIds = mapped.map((m) => m.externalId)
    const pruned = await db
      .delete(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.userId, conn.userId),
          eq(schema.calendarEvents.connectionId, conn.id),
          keepIds.length > 0
            ? notInArray(schema.calendarEvents.externalId, keepIds)
            : undefined,
        ),
      )
      .returning({ id: schema.calendarEvents.id })

    await db
      .update(schema.googleCalendarConnections)
      .set({ lastSyncedAt: new Date(), lastSyncError: null, updatedAt: new Date() })
      .where(eq(schema.googleCalendarConnections.id, conn.id))

    return { upserted: mapped.length, pruned: pruned.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(schema.googleCalendarConnections)
      .set({ lastSyncError: message, updatedAt: new Date() })
      .where(eq(schema.googleCalendarConnections.id, conn.id))
      .catch(() => { /* don't mask the original error */ })
    throw err
  }
}

/**
 * Syncs every Google account the user has connected. One account failing doesn't
 * stop the others; it's reported in `accounts` and in its `last_sync_error`.
 * Throws only when every enabled account failed, so callers can surface that.
 */
export async function syncGoogleCalendarForUser(userId: string): Promise<SyncResult> {
  const conns = await db
    .select()
    .from(schema.googleCalendarConnections)
    .where(eq(schema.googleCalendarConnections.userId, userId))
    .orderBy(asc(schema.googleCalendarConnections.createdAt))

  if (conns.length === 0) return { userId, status: 'not_connected', upserted: 0, pruned: 0, accounts: [] }

  const accounts: AccountSyncResult[] = []
  let firstError: unknown = null
  for (const conn of conns) {
    const base = { connectionId: conn.id, email: conn.googleEmail }
    if (!conn.syncEnabled) {
      accounts.push({ ...base, status: 'disabled', upserted: 0, pruned: 0 })
      continue
    }
    try {
      accounts.push({ ...base, status: 'ok', ...(await syncConnection(conn)) })
    } catch (err) {
      firstError ??= err
      accounts.push({ ...base, status: 'error', upserted: 0, pruned: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }

  const synced = accounts.filter((a) => a.status === 'ok')
  if (synced.length === 0 && firstError) throw firstError
  return {
    userId,
    status: synced.length > 0 ? 'ok' : 'disabled',
    upserted: synced.reduce((n, a) => n + a.upserted, 0),
    pruned: synced.reduce((n, a) => n + a.pruned, 0),
    accounts,
  }
}

/**
 * Syncs every user with at least one connection that has `sync_enabled = true`.
 * Per-user errors are caught and surfaced in the result array so one bad
 * account doesn't abort the batch. (Used by the scheduled cron.)
 */
export async function syncAllEnabledUsers(): Promise<
  (SyncResult | { userId: string; error: string })[]
> {
  const users = await db
    .selectDistinct({ userId: schema.googleCalendarConnections.userId })
    .from(schema.googleCalendarConnections)
    .where(eq(schema.googleCalendarConnections.syncEnabled, true))

  const results: (SyncResult | { userId: string; error: string })[] = []
  for (const { userId } of users) {
    try {
      results.push(await syncGoogleCalendarForUser(userId))
    } catch (err) {
      results.push({ userId, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}
