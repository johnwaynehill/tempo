# Tempo Feature Backlog

Ideas and future features. Bugs and sprint work live in the Tempo app (project: Tempo).
Completed work is tracked in `CHANGELOG.md`.
Research-informed priorities are in the PRD backlog (`PRD.md` § Remaining Backlog).

---

## Today View
~~Built~~ — Now card on Today (#117): day summary line ("3 tasks · 1h 30m · done by ~5:25 PM"), play affordance on rows, the running task lifted into a card with timer, progress, pause/stop and complete (no duplicate row). Plan in `TimeVisibility.md`. Remaining:
- Consider adding a view of Habits into Today
- ~~Overcommitment detection: warn when total estimated time exceeds available hours~~ — shipped (#119): working-hours preference, free time minus today's timed events, one gentle sentence on Today and Plan My Day when over by 30+ min

✓ Chat bar fixed at bottom with safe-area-aware positioning (#66)

## Tempo AI
~~Built~~ — Server-side morning auto-plan (#92): Railway cron service hits the API daily at 06:30 PT, picks 3–5 todos via Anthropic, replaces Today. Opt-in via Settings. Also nightly Claude Routine (#91) writes a `Plan for <tomorrow>` Tempo Note at 21:00 PT for review. Remaining:
- Chat bar should stay fixed at the bottom
- Chat bar should expand in height up to a max of 7 lines of text
- Weird zoom-in issue when selecting the Chat bar
- Tempo AI header has weird scrolling issue

## Navigation
~~Built~~ — Slide-out menu panel (#74), Notes moved to menu, 4 core tabs + More button, consistent hamburger on all pages, icon-only New buttons. Remaining:
- Consider swipe gesture to open/close menu panel
- Animate tab bar highlight when switching tabs

## Voice Input
Ability to input ToDos and Notes with Voice. Mac only for now. Consider https://www.onresonant.com/ also consider Google's new Gemma 4 and AI Edge at https://ai.google.dev/edge

## Mood Tracking
Like https://www.tiimoapp.com/product/mood-tracking. A simple slider with a big, emotional face.
- Track mood anytime
- Mood tracking as an automatic habit (autocompletes when mood is tracked)
- Sync to Apple Health (optional)

## Time Tracker & Time Blindness
~~Built~~ — Timer, dynamic end-time, and time estimates shipped (#46). Now card on Today (#117). Time estimation calibration: `started_at` / `actual_minutes` on todos, "Time sense" in Weekly Review, size hints under estimate chips (#118). Remaining: see `TimeVisibility.md` phase 3 (overcommitment) and phase 4 (playlist Start & focus).

## Guided Planning & Rituals
~~Built~~ — Morning planning (#49), Focus Mode (#47), transition breathing space (#47) shipped. Remaining:
- Daily shutdown ritual: review completed → defer unfinished → one-sentence reflection → set tomorrow's energy

## Decision Paralysis & Quick Capture
~~Built~~ — "Just pick for me" AI picker (#50), smart quick capture (#50), "Not Now" capture in Focus Mode (#47) shipped.

## ADHD Paralysis
We created "Unstick Me" prompts for hard-to-tackle todos. Build more features that help with ADHD paralysis. See https://www.tiimoapp.com/resource-hub/adhd-paralysis for inspiration.

## Sensory & Emotional Design
~~Partially built~~ — Completion sparkle (#51), adaptive energy theme (#51, #52) shipped. Remaining:
- Ambient soundscapes: white/pink/brown noise + nature sounds (research-backed for ADHD focus)
- Micro-celebration variety: randomize completion feedback to combat hedonic adaptation (sparkle is v1; add sound, text, color bloom variety)
- Shame-free visual language audit: ensure no implicit judgment anywhere in the UI

## Routine Playlists
~~Built~~ — Full CRUD + "Start" flow shipped (#51). Remaining enhancements:
- Voice-guided step-by-step execution
- ~~Auto-advance between steps with timer~~ / ~~Timer integration per playlist item during playback~~ — shipped (#120): **Start & focus** on playlist detail walks the steps in order in Focus Mode (`/focus?queue=…`)

## Auth
- Migrate from Firebase Auth to Better Auth (self-hosted). Full plan in `BetterAuthMigration.md`.

## CLI
- CLI tool for Tempo (unsure if needed given MCP server exists)

## Tech Stack
- Consider moving to Swift to build native Mac, iPhone, and iPad apps. Create a Pros/Cons list and really understand the limitations of this. Only after using the app for 2 weeks.

## Remote MCP
- Take the local MCP and make it remove
- Create a Connector for Claude usage across the board
- How would we handle authentication for both myself and my work laptop usage?
