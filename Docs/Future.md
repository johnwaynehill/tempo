# Tempo Feature Backlog

Ideas and future features. Bugs and sprint work live in the Tempo app (project: Tempo).
Completed work is tracked in `CHANGELOG.md`.

---

## Today View
- Consider adding a view of Habits into Today
- Keep Tempo AI Chat bar at the bottom and visible even if the page scrolls

## Tempo AI
- Chat bar should stay fixed at the bottom
- Chat bar should expand in height up to a max of 7 lines of text
- Weird zoom-in issue when selecting the Chat bar
- Tempo AI header has weird scrolling issue
- Proactive daily suggestions when opening Today page
- Add AI icon to the bottom Nav Bar for iOS (unsure)

## Navigation
- Simplify the navigation for mobile. Do a UX Designer pass to first understand what the navigation should be. Max of 5 nav items for mobile.

## Modes
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

## Time Tracker
Like https://www.tiimoapp.com/product/focus. A countdown timer built for time agnosia.
- Count down timer from a small list (5, 15, 25, 45 mins)
- Ability to add 1 min from a button
- Select ToDos to accomplish during this timer

## ADHD Paralysis
We created "Unstick Me" prompts for hard-to-tackle todos. Build more features that help with ADHD paralysis. See https://www.tiimoapp.com/resource-hub/adhd-paralysis for inspiration.

## Auth
- Migrate from Firebase Auth to Better Auth (self-hosted). Full plan in `BetterAuthMigration.md`.

## CLI
- CLI tool for Tempo (unsure if needed given MCP server exists)
