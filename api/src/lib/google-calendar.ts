/**
 * Google Calendar sync engine (Phase 2).
 *
 * One-way: mirrors the user's **primary** Google calendar into `calendar_events`
 * as read-only `source='google'` rows, over a rolling window of −7 to +90 days.
 *
 * Strategy: each run does a full re-list of the window (no sync token) and
 * reconciles — upsert everything returned, then prune any `source='google'`
 * rows for the user that weren't returned (covers deletions, cancellations, and
 * events that have aged out of the window). With a small window and a
 * twice-daily cadence this is simpler and more robust than incremental
 * sync-token bookkeeping, and it's naturally idempotent.
 */

import { and, eq, notInArray } from 'drizzle-orm'
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

export interface SyncResult {
  userId: string
  status: 'ok' | 'not_connected' | 'disabled'
  upserted: number
  pruned: number
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
    .where(eq(schema.googleCalendarConnections.userId, conn.userId))
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
  // All-day events use `date` (no time); timed events use `dateTime`. For
  // all-day we anchor at local midnight to avoid a timezone day-shift on display.
  const allDay = Boolean(e.start?.date)
  const start = allDay ? new Date(`${e.start!.date}T00:00:00`) : new Date(e.start!.dateTime!)
  const end = allDay ? new Date(`${e.end!.date}T00:00:00`) : new Date(e.end!.dateTime!)
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
 * Syncs one user's primary Google calendar into `calendar_events`. Records
 * `last_synced_at` / `last_sync_error` on the connection. Throws on failure
 * (after recording the error) so callers can surface it.
 */
export async function syncGoogleCalendarForUser(userId: string): Promise<SyncResult> {
  const [conn] = await db
    .select()
    .from(schema.googleCalendarConnections)
    .where(eq(schema.googleCalendarConnections.userId, userId))

  if (!conn) return { userId, status: 'not_connected', upserted: 0, pruned: 0 }
  if (!conn.syncEnabled) return { userId, status: 'disabled', upserted: 0, pruned: 0 }

  try {
    const accessToken = await getFreshAccessToken(conn)
    const now = Date.now()
    const timeMin = new Date(now - WINDOW_PAST_DAYS * DAY_MS).toISOString()
    const timeMax = new Date(now + WINDOW_FUTURE_DAYS * DAY_MS).toISOString()

    const raw = await listPrimaryEvents(accessToken, timeMin, timeMax)
    const mapped = raw
      .filter((e) => e.status !== 'cancelled' && (e.start?.date || e.start?.dateTime))
      .map(mapEvent)

    // Upsert each event by (user_id, external_id).
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
        .values({ userId, source: 'google', externalId: m.externalId, ...values })
        .onConflictDoUpdate({
          target: [schema.calendarEvents.userId, schema.calendarEvents.externalId],
          set: values,
        })
    }

    // Prune any google rows for this user not in the current window/result set —
    // covers deletions, cancellations, and events that aged out of the window.
    const keepIds = mapped.map((m) => m.externalId)
    const pruned = await db
      .delete(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.userId, userId),
          eq(schema.calendarEvents.source, 'google'),
          keepIds.length > 0
            ? notInArray(schema.calendarEvents.externalId, keepIds)
            : undefined,
        ),
      )
      .returning({ id: schema.calendarEvents.id })

    await db
      .update(schema.googleCalendarConnections)
      .set({ lastSyncedAt: new Date(), lastSyncError: null, updatedAt: new Date() })
      .where(eq(schema.googleCalendarConnections.userId, userId))

    return { userId, status: 'ok', upserted: mapped.length, pruned: pruned.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(schema.googleCalendarConnections)
      .set({ lastSyncError: message, updatedAt: new Date() })
      .where(eq(schema.googleCalendarConnections.userId, userId))
      .catch(() => { /* don't mask the original error */ })
    throw err
  }
}

/**
 * Syncs every connection with `sync_enabled = true`. Per-user errors are caught
 * and surfaced in the result array so one bad account doesn't abort the batch.
 * (Used by the scheduled cron in Phase 4.)
 */
export async function syncAllEnabledUsers(): Promise<
  (SyncResult | { userId: string; error: string })[]
> {
  const conns = await db
    .select({ userId: schema.googleCalendarConnections.userId })
    .from(schema.googleCalendarConnections)
    .where(eq(schema.googleCalendarConnections.syncEnabled, true))

  const results: (SyncResult | { userId: string; error: string })[] = []
  for (const { userId } of conns) {
    try {
      results.push(await syncGoogleCalendarForUser(userId))
    } catch (err) {
      results.push({ userId, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}
