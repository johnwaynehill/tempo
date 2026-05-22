# Tempo API Reference

REST API for Tempo — a personal productivity app for ADHD. Built on Express 5 + Drizzle ORM + Postgres. Source lives in [api/](../api/).

- **Base URL (production):** `https://tempo-api-production.up.railway.app`
- **Base URL (local):** `http://localhost:3001`
- **Content-Type:** `application/json` for all request/response bodies
- **Date format:** ISO 8601 strings (e.g. `2026-04-22T09:30:00Z`). The server auto-parses date-shaped strings in request bodies into `Date` objects.

---

## Table of Contents

- [Authentication](#authentication)
- [Conventions](#conventions)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Auth](#auth)
  - [Todos](#todos)
  - [Notes](#notes)
  - [Projects](#projects)
  - [Habits](#habits)
  - [Events](#events)
  - [Preferences](#preferences)
  - [Today Set](#today-set)
  - [Reviews](#reviews)
  - [Playlists](#playlists)
  - [Mood](#mood)
  - [Conversations](#conversations)
  - [Anthropic Proxy](#anthropic-proxy)
  - [API Keys](#api-keys)
  - [MCP OAuth State](#mcp-oauth-state)
  - [Internal endpoints](#internal-endpoints)
- [Enums](#enums)
- [Error Responses](#error-responses)

---

## Authentication

Every endpoint under `/api/*` requires authentication. The server accepts either a Firebase ID token or an API key.

### Firebase ID token (frontend)

```
Authorization: Bearer <firebase_id_token>
```

Verified via `firebase-admin` against the configured project.

### API key (MCP, scripts, external tools)

```
X-API-Key: tempo_<prefix>_<random>
```

Keys are generated via [`POST /api/api-keys`](#api-keys), hashed with SHA-256 before storage, and their `last_used_at` timestamp is updated on each successful call.

### Scopes

API keys carry a list of scopes that determine what they can do. Firebase ID tokens always have full access — scopes only apply to API keys.

| Scope | Grants |
|-------|--------|
| `read` | `GET` on all resource routes |
| `write` | Full CRUD on all resource routes (implies `read`) |
| `ai` | `POST /api/anthropic/v1/messages` (gated separately because it spends money) |
| `legacy` | Pre-scoping keys; treated as full access (`read` + `write` + `ai`) for back-compat. Rotate to a scoped key when convenient. |

If a key lacks the scope required by a route, the API returns **`403 Forbidden`** with `{ "error": "Insufficient scope. ..." }`.

API-key management routes (`/api/api-keys/*`) require **Firebase ID token auth** — an API key cannot mint or delete other API keys, regardless of scope. This prevents privilege escalation.

### Unauthenticated routes

Only `/health` is public.

---

## Conventions

- **User scoping** — every row is scoped by `user_id` (Firebase UID). Auth middleware sets `req.userId`; clients never pass the user ID in request bodies.
- **IDs** — UUIDs are generated server-side via `defaultRandom()`, but clients may pass a client-generated `id` on `POST` requests (used for optimistic UI).
- **Case** — the API speaks **camelCase** on the wire. The frontend maps to `snake_case` internally via `fromApi()` / `toApi()` helpers in [src/lib/api.ts](../src/lib/api.ts).
- **Timestamps** — `createdAt` / `updatedAt` are set server-side and should not be sent on create.
- **Strip-on-update** — `PUT` handlers strip `id`, `userId`, `createdAt`, and `firestoreId` from the body before updating, so it's safe to `PUT` a full object back.
- **Date parsing** — middleware in [api/src/index.ts](../api/src/index.ts) auto-converts any string body value matching `YYYY-MM-DD(THH:MM:SS...)?` into a `Date`. Pure date strings get `T00:00:00` appended.

---

## Endpoints

### Health

#### `GET /health`

Liveness check. **No auth required.**

**200 OK**
```json
{ "status": "ok", "timestamp": "2026-04-22T10:00:00.000Z" }
```

---

### Auth

#### `GET /api/auth/me`

Returns the authenticated user's Firebase profile. Falls back to `{ uid, email: null, ... }` if the Admin SDK lookup fails.

**200 OK**
```json
{
  "uid": "firebase-uid",
  "email": "user@example.com",
  "displayName": "Jane Doe",
  "photoURL": "https://..."
}
```

---

### Todos

Tasks with status, energy, size, recurrence, and due dates. See [`todos` table](../api/src/db/schema.ts).

#### `GET /api/todos`
List all todos for the user. Returns an array.

#### `GET /api/todos/:id`
Get a single todo. **404** if not found or not owned by user.

#### `POST /api/todos`
Create a todo.

**Body** (all fields optional except `title`):
```json
{
  "id": "client-generated-uuid-optional",
  "title": "Write API docs",
  "description": "Cover every endpoint",
  "status": "inbox",
  "progress": 0,
  "project": "Tempo",
  "size": "medium",
  "impact": 3,
  "energyLevel": "medium",
  "dueDate": "2026-04-25T17:00:00Z",
  "supports": "parent-todo-id",
  "noteId": "uuid",
  "deferUntil": "2026-04-23T00:00:00Z",
  "reminderAt": "2026-04-22T14:00:00Z",
  "estimatedMinutes": 30,
  "recurrence": { "frequency": "weekly", "interval": 1 },
  "recurrenceParentId": "uuid"
}
```

**201 Created** — returns the full row.

#### `PUT /api/todos/:id`
Update a todo. Any subset of the create fields. `id`, `userId`, `createdAt`, `firestoreId` in the body are ignored.

#### `DELETE /api/todos/:id`
**204 No Content** on success, **404** if not found.

---

### Notes

Markdown notes with optional project tagging and todo linking.

#### `GET /api/notes`
List notes. Each note includes a `projects: string[]` field resolved from the `note_projects` join table.

#### `GET /api/notes/:id`
Single note with `projects` attached.

#### `POST /api/notes`

**Body:**
```json
{
  "title": "Weekly plan",
  "content": "# Plan\n\n- [ ] Ship docs",
  "linkedTodoId": "uuid-or-null",
  "inlineTodoMap": { "task-id": "uuid" },
  "projects": ["Tempo", "Writing"]
}
```

If `projects` is provided, missing project names are created and the join table is synced.

**201 Created** — returns the note with its `projects` array.

#### `PUT /api/notes/:id`
Update a note. Passing `projects: []` clears all project links; omitting it leaves them untouched.

#### `DELETE /api/notes/:id`
**204** on success.

---

### Projects

Named categories. Unique per `(user_id, name)`. Cascades to the `note_projects` join table on delete; `todos.project` is cleared (not deleted) so the tasks survive.

#### `GET /api/projects`
List all projects for the user.

#### `POST /api/projects`
Create or return existing project by name.

**Body:** `{ "name": "Tempo" }`

**400** if name is empty/whitespace. **200** if it already existed, **201** if freshly created.

#### `PUT /api/projects/:id`
Rename. Cascades to `todos.project` for all matching rows.

**Body:** `{ "name": "New Name" }`

#### `DELETE /api/projects/:id`
**204** on success. Clears `todos.project` for matching todos before deleting.

---

### Habits

Daily habits with a `completions` JSON map keyed by `YYYY-MM-DD`.

#### `GET /api/habits`
List habits.

#### `GET /api/habits/:id`
Single habit.

#### `POST /api/habits`

**Body:**
```json
{
  "name": "Meditate",
  "description": "10 min morning",
  "frequency": "daily",
  "archived": false,
  "completions": {}
}
```

#### `PUT /api/habits/:id`
Update. Same fields as create.

#### `PATCH /api/habits/:id/completions`
Toggle a single date's completion without rewriting the whole `completions` map.

**Body:**
```json
{ "date": "2026-04-22", "completed": true }
```

Setting `completed: false` removes the date key entirely.

#### `DELETE /api/habits/:id`
**204** on success.

---

### Events

Calendar events with start/end timestamps and optional color.

#### `GET /api/events`
List all events.

#### `GET /api/events/:id`
Single event.

#### `POST /api/events`

**Body:**
```json
{
  "title": "Standup",
  "startTime": "2026-04-22T09:00:00Z",
  "endTime": "2026-04-22T09:15:00Z",
  "allDay": false,
  "description": "Daily sync",
  "location": "Zoom",
  "color": "primary"
}
```

#### `PUT /api/events/:id`
Update. Same fields as create.

#### `DELETE /api/events/:id`
**204** on success.

---

### Preferences

Per-user settings. Single row keyed by `user_id` (upsert semantics).

#### `GET /api/preferences`
Returns the user's preferences, or `{ userId, theme: "system", notificationsEnabled: false, autoplanEnabled: false, autoplanTimezone: "America/Los_Angeles" }` if none exist yet.

#### `PUT /api/preferences`
Upsert.

**Body:**
```json
{
  "currentEnergy": "medium",
  "theme": "dark",
  "notificationsEnabled": true,
  "adaptiveTheme": false,
  "autoplanEnabled": true,
  "autoplanTimezone": "America/Los_Angeles"
}
```

Fields:
- `currentEnergy` — `"low" | "medium_low" | "medium" | "high" | null`. Optional.
- `theme` — `"light" | "dark" | "system"`. Default `"system"`.
- `notificationsEnabled` — boolean. Default `false`.
- `adaptiveTheme` — boolean. Default `false`. Tints UI based on `currentEnergy`.
- `autoplanEnabled` — boolean. Default `false`. Opts the user into the server-side morning auto-plan (see *Internal endpoints* below).
- `autoplanTimezone` — IANA timezone string. Default `"America/Los_Angeles"`. Determines when "today" rolls over for idempotency.

---

### Internal endpoints

These are not for external API consumers. They live under `/api/internal/*` and are guarded by their own shared-secret headers, not by Firebase / API-key auth. Documented here for ops visibility.

#### `POST /api/internal/autoplan`

Fires the morning auto-plan: for every user with `autoplanEnabled = true`, picks 3–5 todos and replaces their Today view. Triggered daily at 13:30 UTC by the `autoplan-cron` Railway service.

**Auth:** `X-Autoplan-Secret: <secret>` matching the API service's `AUTOPLAN_SECRET` env var. Returns 503 if the env var is unset (never open-by-default).

**Optional body:**
```json
{ "userId": "<uid>", "timezone": "America/Los_Angeles", "force": true }
```
- `userId` — run for a single user (testing / manual trigger).
- `timezone` — overrides the user's stored `autoplanTimezone`. Single-user mode only.
- `force` — bypass the per-day idempotency check. Also accepted as `?force=1` query param.

**200 OK**
```json
{
  "ok": true,
  "count": 1,
  "results": [{
    "userId": "...",
    "pickedTodoIds": ["...", "...", "..."],
    "source": "ai",
    "candidateCount": 12,
    "todayDate": "2026-05-22"
  }]
}
```
`source` is `"ai"` when Anthropic ranked the picks, `"heuristic"` when it fell back (Anthropic timeout or `ANTHROPIC_API_KEY` unset), or `"noop"` when idempotency skipped a duplicate run.

---

### Today Set

The curated list of todos pinned for a specific day (max 5 in the UI, but the API doesn't enforce a cap). One row per `(user_id, date)`.

#### `GET /api/today-set`
Get the set for a specific date.

**Query:** `?date=YYYY-MM-DD` (defaults to today in server local time).

**200 OK**
```json
{ "userId": "...", "date": "2026-04-22", "todoIds": ["uuid1", "uuid2"] }
```

Returns an empty stub if no row exists.

#### `PUT /api/today-set`
Upsert.

**Body:**
```json
{ "date": "2026-04-22", "todoIds": ["uuid1", "uuid2", "uuid3"] }
```

---

### Reviews

Weekly reflection text. `id` is client-supplied (typically the ISO week string like `2026-W17`).

#### `GET /api/reviews`
List all reviews.

#### `GET /api/reviews/:id`
Single review.

#### `PUT /api/reviews/:id`
Upsert reflection.

**Body:**
```json
{ "reflection": "This week I shipped..." }
```

---

### Playlists

Routine templates — a named list of task items that can be expanded into real todos.

#### `GET /api/playlists`
List playlists; each includes an `items` array sorted by `sortOrder`.

#### `GET /api/playlists/:id`
Single playlist with items.

#### `POST /api/playlists`

**Body:**
```json
{
  "name": "Morning routine",
  "description": "Daily kickoff",
  "items": [
    {
      "title": "Stretch",
      "size": "small",
      "energyLevel": "low",
      "estimatedMinutes": 5,
      "project": "Health",
      "sortOrder": 0
    }
  ]
}
```

**201 Created** — returns the playlist with its items.

#### `PUT /api/playlists/:id`
Update. If `items` is provided, the existing items are **fully replaced**.

#### `DELETE /api/playlists/:id`
**204** on success. Items cascade.

#### `POST /api/playlists/:id/start`
Materialize the playlist into actual todos with `status: "today_pinned"`. Returns the new todo IDs.

**200 OK**
```json
{ "todoIds": ["uuid1", "uuid2"], "count": 2 }
```

---

### Mood

Continuous 1–100 mood scale with optional note.

#### `POST /api/mood`
Log a new mood entry. Also auto-completes any non-archived habit whose name contains "mood" (case-insensitive) for today.

**Body:**
```json
{ "value": 72, "note": "Energized after walk" }
```

**400** if `value` is missing or out of range (1–100).

#### `GET /api/mood`
Get history.

**Query:** `?days=7` (default 7, max 100 entries returned).

#### `GET /api/mood/latest`
Most recent entry, or `null` if none.

---

### Conversations

AI chat history. Each conversation stores two message arrays — `displayMessages` for the UI and `apiMessages` for the Anthropic API.

#### `GET /api/conversations`
List the 20 most recently updated conversations.

#### `GET /api/conversations/:id`
Single conversation.

#### `PUT /api/conversations/:id`
Upsert. The ID is client-generated so the frontend can stream into a known URL.

**Body:**
```json
{
  "mode": "coach",
  "todoId": "uuid-or-null",
  "style": "socratic",
  "title": "Planning session",
  "displayMessages": [{ "role": "user", "content": "..." }],
  "apiMessages": [{ "role": "user", "content": [{ "type": "text", "text": "..." }] }]
}
```

#### `DELETE /api/conversations/:id`
**204** on success.

---

### Anthropic Proxy

Server-side proxy to `api.anthropic.com`. Injects `ANTHROPIC_API_KEY` so the browser never sees it. Supports streaming.

#### `POST /api/anthropic/v1/messages`

**Request:** identical to [Anthropic Messages API](https://docs.anthropic.com/en/api/messages). Pass `anthropic-version` as a header if you need a non-default version (defaults to `2023-06-01`).

**Streaming:** set `stream: true` in the body. The response is forwarded as SSE (`text/event-stream`).

**Errors**
- `500` — `ANTHROPIC_API_KEY` not configured on the server.
- `502` — upstream Anthropic unreachable.
- Other statuses are passed through from upstream.

---

### API Keys

Manage long-lived keys for MCP / external integrations. Keys are hashed (SHA-256) before storage — the plaintext is **only** returned once, at creation.

> **Auth requirement:** all `/api/api-keys/*` routes require a **Firebase ID token**. API keys cannot mint or delete other API keys.

#### `GET /api/api-keys`
List the user's keys. The `keyHash` is never returned; `keyPrefix` is a truncated preview for UI display.

```json
[
  {
    "id": "uuid",
    "keyPrefix": "tempo_abcd1234_xx...",
    "name": "MCP",
    "scopes": ["read", "write"],
    "createdAt": "2026-04-01T00:00:00Z",
    "lastUsedAt": "2026-04-22T10:00:00Z"
  }
]
```

#### `POST /api/api-keys`
Create a key.

**Body:**
```json
{ "name": "MCP", "scopes": ["read", "write"] }
```

- `name` — optional; defaults to `"Default"`.
- `scopes` — array of `"read" | "write" | "ai"`. Defaults to `["read"]` if omitted (least privilege). Invalid entries are silently dropped.

**201 Created**
```json
{
  "id": "uuid",
  "key": "tempo_abcd1234_randomrandomrandom",
  "keyPrefix": "tempo_abcd1234_xx...",
  "name": "MCP",
  "scopes": ["read", "write"],
  "createdAt": "2026-04-22T10:00:00Z"
}
```

**⚠️ Store `key` immediately.** It cannot be retrieved later.

#### `DELETE /api/api-keys/:id`
**204** on success.

---

### MCP OAuth State

Internal storage for the MCP OAuth flow (client registrations, access tokens, refresh tokens). Used by the remote MCP server — not typically called by app code.

#### `GET /api/mcp-oauth/:type/:key`
Returns the stored `data` blob. **404** if missing or expired (expired rows are deleted on read).

#### `PUT /api/mcp-oauth/:type/:key`

**Body:**
```json
{ "data": { ... }, "expiresAt": "2026-04-22T11:00:00Z" }
```

`expiresAt` is optional.

**204 No Content**

#### `DELETE /api/mcp-oauth/:type/:key`
**204 No Content**

---

## Enums

Defined in [api/src/db/schema.ts](../api/src/db/schema.ts).

| Enum | Values |
|------|--------|
| `todoStatus` | `inbox`, `today_pinned`, `backlog`, `deferred`, `done` |
| `todoSize` | `small`, `medium`, `large` |
| `energyLevel` | `low`, `medium_low`, `medium`, `high` |
| `recurrenceFrequency` | `daily`, `weekly`, `monthly` |
| `eventColor` | `primary`, `tertiary`, `error`, `neutral` |
| `themePreference` | `light`, `dark`, `system` |

---

## Error Responses

Errors are returned as JSON with an `error` string.

| Status | Meaning |
|--------|---------|
| `400` | Validation error (e.g. empty project name, mood out of range) |
| `401` | Missing, invalid, or expired credentials |
| `403` | Authenticated but lacking the required scope (or attempting to use an API key on `/api/api-keys/*`) |
| `404` | Resource not found or not owned by the authenticated user |
| `429` | Rate limit exceeded (see `RateLimit-*` headers for the policy and reset time) |
| `500` | Server misconfiguration (e.g. missing `ANTHROPIC_API_KEY`) |
| `502` | Upstream service unreachable (Anthropic proxy only) |

All other 4xx/5xx responses from dependent services (the Anthropic proxy) are forwarded verbatim.
