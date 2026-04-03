# Future features to add to Tempo

## Notes Updates
**Select text to format**
- [x] User can select text on screen to change the format of the text. Selecting displays a small menu above or below the text based on where the text is on the screen.
- [x] all markdown is available with smart defaults; scrolls within left/right.
- [x] add confirmation for Delete note
- [x] Add Create Note button to Notes page which creates and opens the note for direct editing within 3 seconds
- [x] On mobile devices, add the Markdown editor bar above the keyboard
- [x] Add Settings + profile pic to mobile Today header
- [x] Add "Check for updates" button to Settings page

## ToDo Updates
**Detail in Popup**
- [x] instead of openning the details of a ToDo inline, use a popup that allows me to focus just on that 1 ToDo
- [x] Make "All done" more celebratory
- [x] Add dropdown to Project section of ToDo detail panel
- [x] Add typeahead to Project section of ToDo detail panel
- [x] Need a way to see Completed ToDos; defaults to ToDos completed today, but should allow me to filter to see This Week, This Month, etc.
  - [x] Ability to mark a completed ToDo as not completed

## Today View
- [x] Fixed daily set of 5 todos — list shrinks as items are completed, no backfill
~~Ability to drag-and-drop ToDos for sorting~~
- [ ] Add a AI generated "good job" message on random ToDo completions; consider using a Toast notificaiton or some sort of screen takeover with some light animation

## Backlog Updates
- [x] It's not obvious that a pill is selected for Filter due to colors being the same as selected state
- [x] Make Projects folders instead of collapsible items
  - [x] Add Projects to the Sidebar for Desktop. Consider how to add on Mobile.

## Habit Tracker
- [x] Start a new habit
- [x] Track each habit daily
- [x] GitHub style visualization for All Habits
- [x] Habit detail page
  - [x] Infomation about habit
  - [x] Habit history
  - [x] GitHub style visualization
  - [x] Edit habit
  - [x] Delete habit
- [x] Add Habits to the mobile bottom navigation

## Visualizations
- [x] Data visualizations to show To Dos
  - [x] Completed
  - [x] By Project
  - [x] Completed on Time
  - [x] Completed after due date
  - [x] By Day, Week, Month

## Voice Input with Transcription
Ability to input ToDos and Notes with Voice. Mac only for now. Use something like https://www.onresonant.com/ (future)


## Inbox
- [x] Make 'inbox zero' more celebratory

## Modes
Ability to switch contexts between Work and Personal modes; each with thier own database

### Work Mode
- [ ] ability to switch into a Work only mode, with a different database
- [ ] ability to switch into a Personal only mode, with it's own database
- [ ] See which mode I'm in at any given time

## Calendar View
- [x] See tasks on a calendar
- [x] Add recuring work meetings to understand rythmn
- [x] Add recuring personal meetings to understand rythmn

## Claude AI
- [x] Add Claude AI so that I can ask AI questions about my Todos, Notes, and Habits
  - [x] Chat bar on Today page for day planning
  - [x] Claude has full context of all todos, notes (with previews), habits, and calendar events
- [x] Use Claude to update the daily ToDos in Today.
  - [x] Claude can create, pin, defer, dismiss, and complete todos via tool_use
  - [x] Hard 5-item cap on Today list enforced in system prompt
- [x] Add ability to breakdown ToDos in an ADHD friendly way.
  - [x] "Unstick Me" button in Todo Detail Drawer with 3 modes:
  - [x] 1. **Micro-steps** — "Break this down into the most ridiculous, tiny, micro-steps. Just give me the first step."
  - [x] 2. **Gamify** — "Give me 3 chaotic, highly stimulating ways to gamify this task."
  - [x] 3. **Transition protocol** — "Give me a 5-minute, low-energy transition protocol to shift out of freeze mode."
- [x] Claude can create, update, and read Notes (summaries, reflections, plans)
- [x] Firebase Cloud Function proxy for production (API key server-side, Firebase auth verified, path allowlist hardened)
- [x] 5-item Today cap enforced in both curation and breakdown modes
- [x] Chat history persistence (conversations saved to Firestore, restored on return)
- [ ] Proactive daily suggestions when opening Today page
- [x] Remove Plus FAB from Claude pages.

## Desktop App
- [x] Clean up left navigation Rail
  - [x] Removed collapsible Projects and Reflect sections
  - [x] Organized into 4 visual nav groups: Main, Capture, Track, Reflect
  - [x] Slimmer sidebar (w-52)
- [x] Remove Projects from left nav rail
- [x] Change Backlog Project filter to something more user friendly
  - [x] Unified toolbar: `[List | Cal]  [Project ▾]  [Energy ▾]  [Sort ▾]`
  - [x] Same compact dropdown approach on mobile and desktop
  - [x] Backlog defaults to show All Project ToDos; filter is optional
- [x] Merged Calendar into Backlog as a view toggle (List / Calendar)
- [x] Replaced collapsible project groups with flat section headers
- [x] Do UX pass with appropriate tools
  - [x] Mobile touch targets (44px minimum across all interactive elements)
  - [x] iOS auto-zoom prevention (16px font on all inputs)
  - [x] Mobile layout fixes (stacked grids, BottomNav spacing)
  - [x] Added .impeccable.md design context for future sessions

## Bugs
- [x] The "new version available" toast's Update Button does not do anything in Prod
- [x] Complete button for a ToDo is in the wrong place. It should be its own, primary CTA on the detail view.

## General Updates
- [x] Remove the floating FAB button and coresponding UI
- [x] Make Hamburger Menu universal for all views
  - [x] Add New ToDo
  - [x] Add New Note
- [x] Create new icon for Claude/AI
  - [ ] Add to the bottom Nav Bar for iOS; (?, unsure)
- [x] Add Completed to mobile hamburger menu
- [x] Add section dividers to mobile hamburger menu
- [x] Tap completed todos to open detail drawer (for delete/edit)
