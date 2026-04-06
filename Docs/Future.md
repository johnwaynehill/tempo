# Tempo Feature Backlog

Ideas and future features. Bugs and sprint work live in the Tempo app (project: Tempo).
Completed work is tracked in `CHANGELOG.md`.
Research-informed priorities are in the PRD backlog (`PRD.md` § Remaining Backlog).

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

## Time Tracker & Time Blindness
Like https://www.tiimoapp.com/product/focus and Llama Life. A countdown timer built for time agnosia.
- Count down timer from a small list (5, 15, 25, 45 mins)
- Ability to add 1 min from a button
- Select ToDos to accomplish during this timer
- Dynamic end-time: "You'll finish everything at X:XX PM" — updates in real time as tasks complete
- Time estimation calibration: track actual vs. estimated time, show patterns in Weekly Review

## Guided Planning & Rituals
Structured flows that externalize executive function. Inspired by Sunsama.
- Morning planning ritual: review yesterday → set energy → AI suggests tasks → confirm → set time estimates → start
- Daily shutdown ritual: review completed → defer unfinished → one-sentence reflection → set tomorrow's energy
- One-task focus mode: hide everything except current task + timer + Done/Skip/Break actions
- Transition breathing space: 3–5 second pause with gentle animation between tasks

## Decision Paralysis & Quick Capture
- Task Roulette: "Surprise me" button that randomly picks the next task from Today's list
- "Not Now" quick capture: ultra-low-friction single text field during focus mode, captures to Inbox instantly
- Overcommitment detection: warn when total estimated time exceeds available hours

## ADHD Paralysis
We created "Unstick Me" prompts for hard-to-tackle todos. Build more features that help with ADHD paralysis. See https://www.tiimoapp.com/resource-hub/adhd-paralysis for inspiration.

## Sensory & Emotional Design
- Ambient soundscapes: white/pink/brown noise + nature sounds (research-backed for ADHD focus)
- Micro-celebration variety: randomize completion feedback to combat hedonic adaptation
- Energy-adaptive interface density: fewer elements on low-energy days, more detail on high-energy days
- Shame-free visual language audit: ensure no implicit judgment anywhere in the UI

## Routine Playlists
Extend Habits with Routinery's "press play" paradigm. Like https://www.routinery.co/
- Pre-sequenced, timer-guided routines (morning, evening, etc.)
- Voice-guided step-by-step execution
- Auto-advance between steps

## Auth
- Migrate from Firebase Auth to Better Auth (self-hosted). Full plan in `BetterAuthMigration.md`.

## CLI
- CLI tool for Tempo (unsure if needed given MCP server exists)

## Tech Stack
- Consider moving to Swift to build native Mac, iPhone, and iPad apps. Create a Pros/Cons list and really understand the limitations of this. Only after using the app for 2 weeks.
