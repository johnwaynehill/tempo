# Tempo Feature Backlog

Ideas and future features. Bugs and sprint work live in the Tempo app (project: Tempo).
Completed work is tracked in `CHANGELOG.md`.
Research-informed priorities are in the PRD backlog (`PRD.md` § Remaining Backlog).

---

## Today View
- Consider adding a view of Habits into Today
- Keep Tempo AI Chat bar at the bottom and visible even if the page scrolls
- Overcommitment detection: warn when total estimated time exceeds available hours

## Tempo AI
- Chat bar should stay fixed at the bottom
- Chat bar should expand in height up to a max of 7 lines of text
- Weird zoom-in issue when selecting the Chat bar
- Tempo AI header has weird scrolling issue
- Proactive daily suggestions when opening Today page
- Add AI icon to the bottom Nav Bar for iOS (unsure)

## Navigation
- Simplify the navigation for mobile. Do a UX Designer pass to first understand what the navigation should be. Max of 5 nav items for mobile.
- Nav icons should be unified; do not use emoji

## Modes
**Nulled by loging in with different accounts**
Ability to switch contexts between Work and Personal modes, each with their own database.
- Ability to switch into Work only mode
- Ability to switch into Personal only mode
- See which mode I'm in at any given time

## Voice Input
Ability to input ToDos and Notes with Voice. Mac only for now. Consider https://www.onresonant.com/

## Mood Tracking
Like https://www.tiimoapp.com/product/mood-tracking. A simple slider with a big, emotional face.
- Track mood anytime
- Mood tracking as an automatic habit (autocompletes when mood is tracked)
- Sync to Apple Health (optional)

## Time Tracker & Time Blindness
~~Built~~ — Timer, dynamic end-time, and time estimates shipped (#46). Remaining:
- Time estimation calibration: track actual vs. estimated time, show patterns in Weekly Review

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
- Auto-advance between steps with timer
- Timer integration per playlist item during playback

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
