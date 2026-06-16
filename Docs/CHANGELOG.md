# Changelog

## 2026-06-16
- Fix the `gcal-sync-cron` Dockerfile so it builds with Railway's default Root Directory (`/`). Its `COPY run.sh …` resolved against the repo-root build context and failed (`"/run.sh": not found`) because `run.sh` lives in the `api/cron-gcal-sync/` subfolder. Changed it to the full repo path `COPY api/cron-gcal-sync/run.sh …`. With Root Directory `/` and the Config-as-Code path set to `api/cron-gcal-sync/railway.json`, the build resolves both the Dockerfile and the script.
- Docs: fix the `gcal-sync-cron` setup README. It omitted the **Root directory: `/`** step, so following it could land the railway.json path in Railway's Root Directory field, failing the build with `stat .../api/cron-gcal-sync/railway.json: not a directory`. Clarified that the repo root is the build root (the `railway.json` path goes in the Config-as-Code field), matching `cron-autoplan`, and added a troubleshooting note for that exact error.

## 2026-06-13
- Google Calendar sync — **Phase 4: scheduled cron** (completes the feature). New internal endpoint `POST /api/internal/google-sync` runs `syncAllEnabledUsers()` for every connection with `sync_enabled = true`; guarded by a shared secret (`X-Google-Sync-Secret` / `GOOGLE_SYNC_SECRET`), disabled-by-default (503 when unset), mounted outside the `/api` auth chain — same pattern as autoplan. New `api/cron-gcal-sync/` Railway cron service (clone of `cron-autoplan`) POSTs to it **twice daily** (`0 13,1 * * *` → ~06:00 and ~18:00 Pacific). **Deploy steps:** set `GOOGLE_SYNC_SECRET` on `tempo-api`, and provision the `gcal-sync-cron` Railway service per `api/cron-gcal-sync/README.md` (set `API_URL` + `GOOGLE_SYNC_SECRET` on it). No DB or schema changes.
- Google Calendar sync — **Phase 3: front-end UI**. Adds a **Google Calendar** section to Settings: a Connect button (redirects to Google consent), and once linked, the connected account email, last-synced time, a **Sync now** button, and **Disconnect**. The page reads the `?google=<status>` OAuth callback param to show a toast (connected / denied / expired / error), then strips it from the URL. On the calendar, `source='google'` events now render **read-only** — a "Google" badge, a distinct dot color, no click-to-edit and no delete button (matching the API's 403 guard) — in both the Calendar page and the Backlog calendar view. Adds `api.googleCalendar.{status,connect,sync,disconnect}` to `src/lib/api.ts` and `source`/`external_id` to the `CalendarEvent` type. No backend or env changes.
- Google Calendar sync — **Phase 2: sync engine** (one-way Google → Tempo). Mirrors the user's **primary** Google calendar into `calendar_events` as read-only `source='google'` rows over a rolling **−7 to +90 day** window. New `api/src/lib/google-calendar.ts` does a full window re-list each run (recurring events expanded via `singleEvents=true`) and reconciles — upsert by `(user_id, external_id)`, then prune any `source='google'` rows not returned (covers deletions, cancellations, and events aged out of the window); idempotent, with automatic access-token refresh. New `POST /api/google-calendar/sync` triggers a sync on demand (background cron lands in Phase 4). `calendar_events` gains `source`/`external_id`/`etag` columns + a `(user_id, external_id)` unique index for upserts (native events stay `source='tempo'`, `external_id` NULL). The events routes now reject edits/deletes to `source='google'` rows (`403`) and ignore client-supplied `source`/`external_id`/`etag`. Disconnect now also purges mirrored events. **Deploy step:** apply `Docs/migrations/2026-06-13-google-calendar-event-source.sql` (additive; do **not** use `db:push` on this project). No new env vars.
- Fix schema drift on the `projects` table — apply the missing `projects_user_id_name_unique` constraint (`UNIQUE (user_id, name)`) to production. The constraint has been defined in `api/src/db/schema.ts` (`unique().on(table.userId, table.name)`) but was never applied to the production Postgres DB; the drift was discovered on 2026-06-09 when `db:push` offered to TRUNCATE the table to reconcile it. Verified zero duplicate `(user_id, name)` rows in production first (no dedupe needed), then applied via a targeted, idempotent migration (`Docs/migrations/2026-06-13-projects-user-name-unique.sql`) rather than `db:push`, which would have bundled unrelated drift into one destructive interactive sync. No app code change — schema already matched; this only reconciles the live database.

## 2026-06-09
- Google Calendar sync — **Phase 1: OAuth account link** (one-way Google → Tempo). Lays the backend foundation for mirroring a user's Google Calendar into Tempo's calendar as read-only events; this phase establishes the account connection only (no event import yet). New `google_calendar_connections` table stores per-user OAuth tokens, **AES-256-GCM encrypted at rest** via `api/src/lib/crypto.ts` (`TOKEN_ENCRYPTION_KEY`). New `api/src/lib/google-oauth.ts` wraps Google's OAuth/OIDC endpoints with plain `fetch` (no `googleapis` dep, matching the Anthropic integration). New routes in `api/src/routes/google-calendar.ts`: `GET /status`, `GET /connect` (returns consent URL), `DELETE /` (revoke + drop), and a **public** `GET /callback` mounted before the `/api` auth chain (Google redirects there without an auth header; a one-time 10-min `state` row in `mcp_oauth_state` ties it back to the user). Integration is disabled-by-default: returns `503` / redirects with `?google=error` unless `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_OAUTH_REDIRECT_URI` and `TOKEN_ENCRYPTION_KEY` are set. **Deploy steps:** run `npm --prefix api run db:push` (or apply `Docs/migrations/2026-06-09-google-calendar-sync.sql`); create a Google Cloud OAuth client and set the env vars per `Docs/GoogleCalendarSync.md`. Later phases add the sync engine, read-only calendar rendering, and a twice-daily cron.
- Fix mobile Toast (`CompletionToast`) layout. The toast button hugged its text content capped at `max-w-[90vw]`, so on narrow phones a medium-length message hit the cap and wrapped to two lines while the toast never used the full width. The wrapper now spans edge-to-edge with even 1rem side margins on mobile (`left-4 right-4`) and reverts to centered (`sm:left-1/2 -translate-x-1/2`) on ≥640px; the button is `w-full` with centered content on mobile and a content-hugging `sm:w-auto sm:max-w-[90vw]` pill on desktop.

## 2026-05-22
- Fix design system page rendering blank in production; switch its URL to the cleaner `/design-system` (was `/design-system.html`). The static server's `cleanUrls` redirect + SPA catch-all combo was stripping `.html` and then serving the React app's `index.html` for a path React Router doesn't have. Folder-with-index layout + explicit rewrites in `public/serve.json` (replacing the Dockerfile's `-s` flag) fixes it. Legacy `/design-system.html` bookmarks still redirect to the clean URL.
- Docs: correct root cause for the `nightly-tempo-plan` autonomous-run failure in `Docs/ClaudeRoutines.md`. The 7-second early termination wasn't a harness session-kill bug — it was an un-approved tool permission prompt that scheduled-task sessions can't service unattended. Section renamed to *First-run setup: pre-approve tool permissions* with the actual fix (run the routine once interactively and click "Always allow"). The *Adding a new routine* section now also reminds operators to do a manual first-fire after creating any new routine.
- Docs: post-autoplan doc updates. `Docs/API.md` adds the new `autoplanEnabled`/`autoplanTimezone` fields to the Preferences endpoint and documents `POST /api/internal/autoplan` under a new *Internal endpoints* section. `Docs/Future.md` marks server-side morning auto-plan (#92) + nightly Claude Routine (#91) as built under *Tempo AI*. `Docs/ProjectReference.md` adds `autoplan-cron` to the Hosting row, points to `api/cron-autoplan/` in the repo tree, and mentions autoplan fields on `user_preferences`. `Docs/ClaudeRoutines.md` gains a *Known issue* callout for the harness terminating scheduled-task sessions before tool results return — observed twice and documented with a workaround.
- Fix deferred todos still showing on Today view. The `useTodaySet` hook resolves the morning `today_set` snapshot to live todo objects but only filtered out `done` todos at render time — so a todo deferred via the Todo Detail page (which doesn't call `dismissFromSet`) stayed in `today_set.todo_ids` and re-rendered on Today with its new `deferred` status. The bug was latent before PR #92 (server-side auto-plan) since most days the `today_set` row was empty; now that auto-plan populates it every morning, the gap is reliably hit. Filter now only keeps `today_pinned` and `backlog` statuses — drops `deferred`, `inbox`, and `done`.

## 2026-05-21
- Server-side morning auto-plan. A new Railway cron service (`autoplan-cron`) hits `POST /api/internal/autoplan` daily at 13:30 UTC (06:30 PT) and, for every user with `autoplan_enabled = true`, replaces their Today view with 3–5 AI-picked todos. Picks reuse the same heuristic-scoring algorithm as the in-app planner (`src/lib/scoring.ts`) ported to the API, with an Anthropic ranking pass over the top 12 candidates to keep the morning load coherent (energy match + due-date urgency + variety). Heuristic-only fallback ships if Anthropic is unreachable. Endpoint is guarded by `AUTOPLAN_SECRET` (returns 503 when unset, never open-by-default) and is idempotent within a 24h window per user. New Settings toggle + timezone field under Preferences. Migration adds `autoplan_enabled`, `autoplan_timezone`, `autoplan_last_run_date` to `user_preferences`. **Deploy step:** run `npm --prefix api run db:push` (or apply `Docs/migrations/2026-05-21-morning-autoplan.sql`) before deploying, set `AUTOPLAN_SECRET` on the `tempo-api` service, and follow `api/cron-autoplan/README.md` to provision the new cron service. Closes the "Have Tempo AI run every morning and automatically update the Today view" and "Auto-plan Today with Tempo AI at a set schedule" bugs.
- Add nightly Claude Routine `nightly-tempo-plan` that fires at 9:00 PM Pacific every day, reviews the user's backlog + inbox via the Tempo MCP, and writes a `Plan for <tomorrow>` Tempo Note with 3–5 picks and short per-todo implementation plans. New `Docs/ClaudeRoutines.md` documents the routine and how to edit/disable it via `mcp__scheduled-tasks__*` tools. Closes the "Schedule Claude to run every night to check Tempo ToDos and write a plan for me to approve" bug (todo `d947e253-f1aa-4920-a6f2-1d5966198b03`).
- Backlog filter persistence + Esc-to-close on Todo detail. The Backlog page now syncs its energy/project/sort/view state to URL search params, so opening a todo and clicking Back restores the exact filtered view (and the URL is now bookmarkable/shareable). Adds an Esc-key shortcut on the Todo detail page that navigates back to the previous view; if a modal/menu is open, Esc closes that first via capture-phase listeners with `stopImmediatePropagation`, so it takes two Esc presses to leave a modal-open detail page. Closes the "Updating a ToDo from a Filtered view should return back" and "Esc shortcut to close ToDo detail" bugs.
- Fix Repeat schedule and Set reminder on Todo detail — both pickers were anchored via `position: absolute` to a trigger element that no longer existed (they're now invoked from the overflow menu), so they rendered off-screen. Reworked both as bottom-sheet on mobile / centered modal on desktop, matching the new `ProjectPicker` pattern. Reminder's custom date picker now uses `DateField`, inheriting the iOS form-field fixes from the previous PR. Closes the "no way to set Repeat schedule" and "Set reminder no longer works" bugs.
- Mobile UX overhaul for Project + Due date inputs on the todo capture/edit flows:
  - **Quick-capture drawer** now uses `ProjectChips` — flat one-tap chips for existing projects instead of an anchored typeahead. Tap a chip to assign, tap again to clear. No menu, no keyboard fight.
  - **Todo detail page** now opens a bottom sheet (mobile) / centered modal (desktop) when picking a project — replaces the anchored popover that fought iOS Safari over positioning. Search input inside, "Create new" option when query doesn't match, ↑/↓/Enter/Esc keyboard nav.
  - **`DateField` component** replaces every `<input type="date">` in the todo forms. Renders a styled button with a transparent native input layered on top, so iOS Safari opens its native picker on tap while we control every visible pixel. Adds an explicit `showPicker()` call on click for Firefox/Chrome desktop, which don't auto-open from a click on the input element.
  - Global CSS rule forces `font-size: 16px` on `input`/`textarea`/`select` under 768px, replacing the per-input `text-base` patch from #31 that kept regressing. Prevents iOS Safari from auto-zooming on focus.
  - `color-scheme: light` / `dark` on `:root` / `[data-theme='dark']` so native form controls (date placeholders, calendar icons, scrollbars) render correctly in both themes — previously the date input's iOS-rendered placeholder was invisible in dark mode.
- Dev workflow: `vite.config.ts` now proxies all `/api/*` calls to `VITE_API_URL` (defaults to `localhost:3001`), and the frontend uses an empty `API_BASE` in dev so requests stay same-origin. Makes phone-on-LAN testing work without adding LAN IPs to the production API's CORS allowlist.

## 2026-04-23
- Polish API-key revocation UX — confirmation modal with key name, last-used date, and an explicit warning about consumers getting `401` immediately; "Delete" renamed to "Revoke" throughout; in-flight loading state and inline error display
- Add scope-based authorization for API keys — `read`, `write`, and `ai` scopes; existing keys default to `legacy` (full access) for migration safety; insufficient scope returns 403; `/api/api-keys/*` routes now require Firebase auth (API keys cannot mint or revoke other API keys). Settings UI shows scope checkboxes on create and badges per existing key. **Deploy step:** run `npm --prefix api run db:push` to add the `scopes` column.

## 2026-04-22
- Add API documentation (`Docs/API.md`) and agent integration quickstart (`Docs/AgentQuickstart.md`)
- Add rate limiting to the API — IP-based pre-auth (100 req/min), user-based post-auth (300 req/min), and stricter per-user limit on the Anthropic proxy (30 req/min); standard RFC `RateLimit-*` headers on all responses

## 2026-04-20
- Add design system showcase page at `/design-system.html` with live light/dark and adaptive-energy toggles, linked from Settings → App (#78)

## 2026-04-19
- Convert mobile hamburger menu from dropdown to slide-out panel — full-height panel from right with backdrop, body scroll lock, quick-create buttons, active-state nav links, sign-out action, and grouped navigation sections (#74)
- Move Notes from bottom tab bar to menu panel, replace with "More" button — bottom nav is now Today, Inbox, Backlog, Habits, More (#74)
- Add consistent hamburger menu button to all page headers via reusable MenuButton component (#74)
- Shrink large "New" buttons to icon-only style on Inbox, Backlog, Notes, Tempo AI, Playlists, and Projects pages (#74)
- Make MobileMenu global in AppShell instead of per-page — removed from 9 individual page files (#74)
- Quick wins: fix Backlog hooks order crash, add description field to todos, bump due-today priority to match overdue, add Brain Dump to mobile menu, fix filter dropdown overflow on mobile (#72, #73)

## 2026-04-17
- Fix MCP server to forward client API key to backend — remote server was using a single server-side key for all API calls, causing all clients to operate as the same user. Now validates and forwards the client's key so each account is isolated (#67)

## 2026-04-14
- Fix mobile UX bugs round 2: FilterDropdown portals to escape overflow clipping (Backlog Sort/Project/Energy dropdowns) with viewport-aware flipping, playlists Create works (server: explicit UUIDs for legacy `id text` columns; client: optimistic cache injection so detail page renders immediately), Today header Plan/Focus buttons match hamburger ghost style, `min-h-dvh` for correct iOS PWA viewport, Today chat bar clears safe-area home indicator, TodoDetailDrawer locks body scroll so page doesn't scroll out from under the modal (#66)
- Only show mood on Today page if logged today — filter the mood widget to today's date only (#65)
- Fix Tempo project todos round 1: double completion toast race condition, habits toggle (API date middleware was stringifying JSONB completion keys), Projects menu separator, Today view mobile layout (#64)

## 2026-04-07
- Fix CORS preflight on MCP endpoint so Claude.ai browser OAuth flow completes (#56)
- Add OAuth 2.0 to MCP server — authorization code flow with PKCE, consent page, token refresh, dual-auth (API key for Claude Code + Bearer for Claude.ai) (#55)
- Deploy MCP server as remote Railway service with Streamable HTTP transport — accessible from Claude.ai, Claude mobile, and Claude Code on any device (#54)

## 2026-04-06
- Fix due date 500 error (plain YYYY-MM-DD strings crashed Drizzle) and add 6 playlist MCP tools + energy/time fields to todo tools (#53)
- Fix adaptive theme contrast — dramatically increased color differentiation between energy levels (#52)
- Add P3: completion sparkle on checkbox, adaptive energy theme toggle in Settings, routine playlists with full CRUD and "Start" flow (#51)
- Add P2: momentum streaks (flame indicator), "Just pick for me" AI task picker, smart quick capture with AI metadata suggestions (#50)
- Add guided daily planning ritual — 5-step morning flow: energy check-in → yesterday review → AI suggestions → confirm → time estimates (#49)
- Add granularity slider (1–5) to AI task breakdown — from broad strokes to baby steps (#48)
- Add one-task Focus Mode — full-screen current task with timer, Done/Skip/Break actions, transition breathing space (#47)
- Add time estimates to todos (5/15/25/45/60/90 min pills) and visual timer with dynamic end-time on Today view (#46)
- Update PRD with research-backed ADHD feature roadmap from competitive analysis (#45)
- Fix hashtag extraction and add visual hashtag badges in note editor (#44)
- Add Projects view page and project field for Notes (#43)

## 2026-04-05
- Update app icon to new Figma design (#40)
- Fix: New Todo and New Note create buttons — Drizzle expects Date objects, not ISO strings (#39)
- Migrate chat history from Firestore to Postgres — Firebase is now auth-only (#38)
- Fix: CORS for Railway frontend domain (#37)
- Add CORS middleware and remove dead Firestore context files (#36)
- Add Tempo MCP server with 17 tools for AI integration (#35)
- Move Anthropic proxy from Firebase Cloud Function to Railway API (#34)
- Swap frontend data layer from Firestore to TanStack Query + REST API (#33)

## 2026-04-04
- Add Express API server with Drizzle ORM and Firestore → Postgres migration (#32)

## 2026-04-03
- Improve mobile UX: 44px touch targets, iOS zoom fix, layout polish (#31)

## 2026-04-02
- Chat history persistence with full markdown toolbar (#30)
- Polish todo drawer: bottom actions + auto-focus title (#29)
- Fix bugs, add Completed page, remove FAB for universal hamburger menu (#28)

## 2026-04-01
- Add Anthropic API proxy via Firebase Cloud Function (#27)
- Merge Calendar into Backlog with unified toolbar (#26)
- Clean up desktop sidebar and Backlog filters (#25)

## 2026-03-31
- Add Claude AI: ADHD task breakdown and Today curation (#24)

## 2026-03-30
- Add Calendar View with month grid and event CRUD (#23)
- Add recurring todos and inline todo checkboxes in notes (#22)
- Add Habit Tracker with daily check-ins and contribution grid (#21)
- Add Insights and Weekly Review pages (#20)
- Add settings & profile to mobile header (#19)
- Add mobile Markdown formatting bar above keyboard (#18)
- Add Create Note button to Notes page (#17)
- Add projects as sidebar folders (#16)

## 2026-03-29
- Today view: fixed daily set of 5 todos (#15)
- Add project dropdown with typeahead (#14)
- Fix mobile responsiveness for PWA (#13)
- Add floating formatting toolbar to Notes editor (#12)

## 2026-03-27
- Soft reminders with gentle notifications (#11)
- Global keyboard shortcuts with help sheet (#10)
- Coda CSV import with column mapping and preview (#9)

## 2026-03-26
- PWA assets, offline indicator, and update prompt (#8)
- Note-todo linking with bidirectional navigation (#7)
- Dark mode with Light / Dark / System toggle (#6)
- Backlog project grouping with collapsible sections and sort (#5)
- Inbox triage flow with progress tracking and batch move (#4)
- Completion animation, defer popover, and satisfaction feedback (#3)
- Refactor: shared Firestore subscription context (#2)
- Wire up Firestore, Milkdown editor, and inline todo editing (#1)
