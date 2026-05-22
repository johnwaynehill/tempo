# Tempo Project Reference

Personal productivity app built for ADHD. Task management, habits, notes, calendar, and AI assistant.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, TypeScript 5.9, Tailwind CSS 4, TanStack Query |
| API | Express 5, Drizzle ORM, Postgres |
| Auth | Firebase Auth (Google Sign-In). See `Docs/BetterAuthMigration.md` for future self-hosted plan. |
| AI | Anthropic Claude via server-side proxy |
| MCP | `@modelcontextprotocol/sdk` — 17 tools for todos, habits, notes, events, reviews, preferences |
| Hosting | Railway (frontend + API + Postgres + `autoplan-cron` cron service) |
| Editor | Milkdown (Markdown, GFM) for Notes |
| PWA | vite-plugin-pwa |

## Repo Structure

```
Tempo/
  src/              React frontend
    components/     UI components
    context/        AuthContext (Firebase Auth only)
    hooks/          Data hooks (TanStack Query + REST API)
    lib/            api.ts, anthropic.ts, ai-tools, recurrence
    pages/          Route pages
    types/          TypeScript types
  api/              Express API server
    src/db/         Drizzle schema + connection
    src/routes/     REST endpoints (todos, notes, habits, events, preferences, today-set, reviews, conversations, api-keys, anthropic)
    src/middleware/  Dual auth (Firebase ID tokens + API keys)
    Dockerfile      Multi-stage Node 22 build
  mcp/              MCP server (stdio transport)
    src/api.ts      API client using TEMPO_API_KEY
    src/index.ts    17 tools with zod validation
  api/cron-autoplan/  Tiny `curlimages/curl` container deployed as a separate
                      Railway service. Cron at 13:30 UTC POSTs to
                      `/api/internal/autoplan` to populate Today for opted-in users.
  Docs/             Documentation
  scripts/          Migration scripts
  public/           Icons, static assets
```

## Key URLs

- **Frontend:** https://tempo.designbyjohnwayne.com
- **API:** https://tempo-api-production.up.railway.app
- **Repo:** https://github.com/johnwaynehill/tempo

## Database

Postgres on Railway. Schema in `api/src/db/schema.ts`. Tables:

- `todos` — tasks with status, project, size, impact, energy, recurrence, due dates
- `notes` — markdown notes with optional todo linking
- `habits` — daily habits with completion map (JSON)
- `calendar_events` — events with start/end times, color
- `conversations` — AI chat history (display + API messages as JSONB)
- `user_preferences` — energy level, theme, autoplan opt-in + timezone
- `today_sets` — daily curated todo lists (max 5)
- `weekly_reviews` — reflection text
- `api_keys` — SHA-256 hashed keys for MCP/external access

All tables use `user_id` (text, Firebase UID) for scoping.

## Auth

Firebase Auth with Google Sign-In popup. API verifies tokens two ways:
1. **Firebase ID token** — `Authorization: Bearer <token>` from frontend
2. **API key** — `X-API-Key: <key>` from MCP server and external tools

## API Patterns

- Client sends snake_case, `toApi()` converts to camelCase for Drizzle
- API returns camelCase, `fromApi()` converts to snake_case for frontend types
- Date strings are auto-parsed to `Date` objects by server middleware (Drizzle requires `Date`, not strings)
- `created_at`/`updated_at` are set server-side via `defaultNow()` — never sent from client on create

## MCP Server

Configured as User MCP in `~/.claude.json` (works across all projects). Uses `TEMPO_API_KEY` and `TEMPO_API_URL` env vars. 17 tools covering full CRUD for todos, habits, notes, events, reviews, and preferences.

## Migration History

1. Firestore → Postgres (one-time script in `scripts/migrate-firestore-to-postgres.mjs`)
2. Firestore real-time listeners → TanStack Query + REST API
3. Firebase Cloud Function proxy → Express `/api/anthropic` route
4. Chat history → Postgres `conversations` table (was last Firestore dependency)
5. Removed all Firestore code. Firebase is now auth-only.

## Conventions

- Always create PRs for new features — never commit directly to main
- Frontend types use snake_case (matching Postgres column names)
- Drizzle schema uses camelCase JS properties mapped to snake_case columns
- Hooks export the same interface as the old Firestore contexts — components didn't need changes
- `uuid` generated client-side for creates, accepted by API via `...req.body` spread
