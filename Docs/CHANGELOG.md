# Changelog

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
