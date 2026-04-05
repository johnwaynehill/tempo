# Changelog

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
