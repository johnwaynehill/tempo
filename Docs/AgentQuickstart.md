# Tempo Agent Quickstart

A short guide for LLM agents and third-party tools that want to read or write Tempo data. For the full endpoint reference, see [API.md](./API.md).

---

## TL;DR

1. Get an API key from **Settings → API Keys** in the Tempo app.
2. Send it as `X-API-Key: tempo_...` on every request.
3. Base URL: `https://tempo-api-production.up.railway.app`
4. All data is automatically scoped to the key's owner.

---

## Which door should I use?

Tempo exposes two integration surfaces. Pick based on your agent.

| | **MCP Server** | **REST API** |
|-|-|-|
| **Best for** | Claude Code, Claude.ai, any MCP-compatible agent | Custom scripts, non-MCP agents, webhooks |
| **Schema** | Typed tools with zod validation | Raw JSON |
| **Discovery** | Tool list with descriptions | This doc |
| **Setup** | Point client at stdio or remote MCP endpoint | Just send HTTP |
| **See** | [`mcp/`](../mcp) | Below |

If your agent speaks MCP, use MCP. The tool schemas do the hard work for you.

---

## Getting a key

1. Sign in to [tempo.designbyjohnwayne.com](https://tempo.designbyjohnwayne.com).
2. Open **Settings → API Keys**.
3. Click **Create Key**, give it a name (e.g. "My agent").
4. Copy the `tempo_...` string immediately — it's only shown once.

Keys are SHA-256 hashed server-side. If you lose it, revoke and re-create.

---

## Making your first request

```bash
curl https://tempo-api-production.up.railway.app/api/todos \
  -H "X-API-Key: tempo_yourkey_here"
```

Returns a JSON array of the user's todos.

### Create a todo

```bash
curl -X POST https://tempo-api-production.up.railway.app/api/todos \
  -H "X-API-Key: tempo_yourkey_here" \
  -H "Content-Type: application/json" \
  -d '{"title":"Review PR","status":"inbox","size":"small","energyLevel":"low"}'
```

### Complete a todo

```bash
curl -X PUT https://tempo-api-production.up.railway.app/api/todos/<id> \
  -H "X-API-Key: tempo_yourkey_here" \
  -H "Content-Type: application/json" \
  -d '{"status":"done","completedAt":"2026-04-22T10:00:00Z"}'
```

---

## The 10 most useful endpoints for agents

These cover ~90% of real agent use cases.

| Verb | Path | Purpose |
|------|------|---------|
| `GET` | `/api/todos` | List all todos |
| `POST` | `/api/todos` | Create a todo |
| `PUT` | `/api/todos/:id` | Update status, priority, etc. |
| `GET` | `/api/today-set?date=YYYY-MM-DD` | See what's pinned for a day |
| `PUT` | `/api/today-set` | Curate a day's plan |
| `GET` | `/api/habits` | List habits + completion map |
| `PATCH` | `/api/habits/:id/completions` | Toggle a habit for a date |
| `POST` | `/api/notes` | Capture a markdown note |
| `POST` | `/api/mood` | Log a 1–100 mood value |
| `PUT` | `/api/preferences` | Set current energy level |

Full list in [API.md](./API.md#endpoints).

---

## Conventions cheat sheet

- **Auth header:** `X-API-Key: tempo_...` (not `Authorization`).
- **Body format:** camelCase JSON.
- **Dates:** ISO 8601 strings — the server parses them into timestamps.
- **User scoping:** automatic. You never pass a user ID.
- **IDs:** the server generates UUIDs, but you can pass your own `id` on create for idempotency.
- **Errors:** `{ "error": "message" }` with a standard HTTP status.

---

## Recommended agent patterns

### Daily check-in

```
GET /api/today-set          → what's planned today
GET /api/mood/latest        → current mood
GET /api/preferences        → current energy level
```

Use these to contextualize any suggestion before writing.

### Safe task creation

Before creating a todo, consider:
- Will it fit the user's current `energyLevel`?
- Is there already a similar todo? (`GET /api/todos` and grep titles)
- Should it go to `inbox` (default, safe) or `today_pinned` (commits to today)?

When in doubt, default to `status: "inbox"`. The user triages from there.

### Never do this

- Don't mass-create todos in a loop — batch in the user's head first.
- Don't set `status: "done"` unless the user explicitly confirmed completion.
- Don't delete anything without confirmation — prefer `status: "deferred"`.
- Don't log mood on the user's behalf without their input.

---

## Rate limits & quotas

*(Not yet enforced — coming soon.)* Plan for:
- Per-key request rate limit
- Per-user Anthropic proxy quota (if you use `/api/anthropic/v1/messages`)

Design your agent to handle `429 Too Many Requests` with exponential backoff.

---

## Revoking a key

If a key leaks:
1. **Tempo app → Settings → API Keys → Delete.**
2. Create a fresh one.

All active requests using the old key will immediately start failing with `401`.

---

## Questions or issues?

File at [github.com/johnwaynehill/tempo/issues](https://github.com/johnwaynehill/tempo/issues).
