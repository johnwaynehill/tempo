# Product Requirements Document
## Tempo — ADHD-First Personal Productivity PWA

**Version:** 0.3
**Author:** Staff PM / UX (Claude)
**Date:** 2026-03-27
**Status:** v1 Complete — v2 Planning

**Changelog (v0.2 → v0.3):**
- Added v2 user stories (US-24 through US-32): floating formatting toolbar, celebratory states, project folders, habit tracker, visualizations, voice input, work/personal modes
- Added v2 Roadmap table with prioritized feature list
- Updated Information Architecture to reflect v2 additions
- Marked todo detail drawer as shipped (US-28 partial)

**Changelog (v0.1 → v0.2):**
- Replaced iCloud/GitHub sync with Firebase Firestore (real-time, offline-first)
- Dropped Obsidian dependency; Tempo becomes the primary note editor with WYSIWYG Markdown
- Switched framework from SvelteKit to Next.js (React)
- Resolved Today view curation: hybrid auto-suggest + manual pin
- Added energy-level matching as a v1 feature
- Promoted note–todo linking to P1
- Scoped reminders to Mac-only for v1 (iOS PWA limitation)
- Resolved all open questions

---

## 1. Problem Statement

You manage todos in Coda and notes as Markdown files. The tools work independently but create friction:

- **Coda** feels overwhelming — too many rows, columns, and views visible at once; mobile UX is slow and clunky; hard to surface "what do I do right now."
- **Notes and tasks are disconnected** — context lives in one place, action items in another.
- **ADHD amplifies all of this**: cognitive overload from long lists, switching between apps, and no single calm place to land.

The result: tasks get dropped, notes pile up unread, and the system itself becomes a source of anxiety rather than relief.

---

## 2. Vision

> **One calm place to capture, focus, and act** — accessible from your Mac and iPhone, with a Markdown editor good enough to replace Obsidian.

Tempo is a PWA that gives you a distraction-reduced interface for your todos and notes. It prioritizes ruthless simplicity: at any moment, the app should help you answer *"what is the one thing I should do next?"* — not show you everything at once.

---

## 3. Target User

**Primary:** You — a person with ADHD who:
- Has a large backlog of todos that causes overwhelm when viewed in full
- Writes and thinks in Markdown
- Needs fast, low-friction capture (the thought will evaporate otherwise)
- Works across Mac (primary) and iPhone (on the go)
- Wants data that is structured, exportable, and readable by AI tools
- Does **not** want to maintain a server or SaaS subscription

---

## 4. Goals & Non-Goals

### Goals
| # | Goal |
|---|------|
| G1 | Surface a focused "Today" view with ≤5 prioritized todos — never the full list by default |
| G2 | Allow friction-free capture of todos and notes in under 3 seconds |
| G3 | Provide a visually calm, minimal UI that reduces cognitive load |
| G4 | Sync seamlessly across Mac and iPhone via Firestore (real-time, no manual step) |
| G5 | Provide a WYSIWYG Markdown note editor good enough to replace Obsidian |
| G6 | Deliver gentle, non-punishing reminders (Mac only in v1) |
| G7 | Work offline-first as a PWA installed on both devices |
| G8 | Match tasks to current energy level (ADHD-specific) |

### Non-Goals (v1)
- Not a team/collaboration tool
- Not a Coda integration (migrate data once; Coda becomes the archive)
- Not a calendar or time-blocking app
- No AI features in v1
- No iOS push notifications in v1 (Web Push unsupported on iOS PWAs)

---

## 5. User Stories

### Core (Must Have)

**Focus**
- `US-01` As a user, I want to open the app and immediately see up to 5 prioritized todos for today, so I know what to do without being overwhelmed.
- `US-02` As a user, I want to mark a todo as complete with a single tap, so checking things off feels satisfying and effortless.
- `US-03` As a user, I want to defer a todo to tomorrow or "someday" without deleting it, so I can clear it from my focus without guilt.
- `US-04` As a user, I want the Today view to auto-suggest tasks based on due date, impact, and energy match — and let me pin or dismiss suggestions to stay in control.

**Energy Matching**
- `US-05` As a user, I want to set my current energy level (low / medium-low / medium / high) so the app surfaces tasks I can realistically do right now.
- `US-06` As a user, I want to filter my Backlog by energy level so I can browse "what can I do with low energy today."

**Capture**
- `US-07` As a user, I want to tap a persistent floating button to add a todo or note from any screen in under 3 seconds.
- `US-08` As a user, I want captured items to land in an "Inbox" so I can process them later without disrupting my current focus.

**Notes**
- `US-09` As a user, I want to write and edit notes in a WYSIWYG Markdown editor that feels as good as Obsidian (headings, bold, italic, code blocks, lists).
- `US-10` As a user, I want to optionally link a note to a todo as "context," so I can see the details when I need them without cluttering the todo list.

**Sync**
- `US-11` As a user, I want my todos and notes available on both my Mac and iPhone with real-time sync (seconds, not minutes).
- `US-12` As a user, I want the app to work fully offline and sync when connectivity is restored.

**Reminders**
- `US-13` As a user, I want to set an optional soft reminder on a todo that nudges me gently (not with alarm-style urgency). *(Mac only in v1.)*

### Important (Should Have)
- `US-14` Backlog view — full list, collapsible by project/area, hidden by default.
- `US-15` Quick "brain dump" mode — a scratchpad that auto-creates inbox items from line breaks.
- `US-16` Keyboard shortcuts on Mac for all primary actions.
- `US-17` Dark mode.
- `US-18` Export all data as JSON + Markdown files (one-click backup, AI-tool-readable).

### Nice to Have (Could Have — v2+)
- `US-19` Recurring todos.
- `US-20` Markdown inline todo syntax (`- [ ]`) in notes auto-syncs to todo list.
- `US-21` Simple tags/areas for grouping todos.
- `US-22` Weekly review screen.
- `US-23` iOS push notifications (when Apple supports Web Push on PWAs).
- `US-24` Floating formatting toolbar — select text in a note to reveal a contextual toolbar (bold, italic, heading, code, link, etc.) that scrolls horizontally for all Markdown options.
- `US-25` Delete note confirmation — prompt before permanently deleting a note.
- `US-26` Celebratory "All done" and "Inbox zero" states — replace plain text with a rewarding moment (animation, confetti, or encouraging message variety).
- `US-27` Backlog filter clarity — improve selected/unselected energy filter pill contrast so it's obvious which is active.
- `US-28` Projects as first-class folders — promote projects from collapsible groups to sidebar navigation items with their own filtered views.
- `US-29` Habit tracker — create, track, and visualize daily habits with a GitHub-style contribution grid (all-habits overview + per-habit detail with history and edit/delete).
- `US-30` Todo visualizations — charts for completed todos by project, on-time vs. late, and trends by day/week/month.
- `US-31` Voice input with transcription — capture todos and notes by voice, transcribed to text.
- `US-32` Work/Personal modes — switch between isolated contexts (separate databases) with a visible mode indicator; each mode has its own todos, notes, and settings.

---

## 6. Information Architecture

```
Tempo
├── Today             ← Default landing view (≤5 prioritized todos)
│   └── Energy selector (persistent in header)
├── Inbox             ← Unprocessed captures
├── Backlog           ← Full todo list (collapsed by default)
│   └── [Project folders]              ← v2: promoted to sidebar nav
│   └── Energy filter
├── Notes
│   ├── [Note list]
│   └── [WYSIWYG Markdown editor]      ← v2: floating formatting toolbar
├── Habits            ← v2: daily habit tracker + contribution grid
├── Insights          ← v2: todo visualizations (completed, by project, trends)
├── Brain Dump        ← Quick scratchpad → Inbox
└── Settings
    ├── Mode selector (Work / Personal) ← v2: isolated databases
    ├── Notification preferences (Mac)
    ├── Import from Coda (CSV)
    └── Export data (JSON + .md)
```

---

## 7. UX Principles

### 7.1 Calm by Default
- The app opens to **Today** — never the full backlog.
- Maximum **5 todos visible** on Today before a "Show more" collapse.
- White/off-white background, one accent color, generous line height.
- No badges, counters, or red indicators on the main view.

### 7.2 Progressive Disclosure
- Details live behind a tap, not in the list row.
- The Backlog is one level deeper than Today — intentionally.
- Notes linked to todos are collapsed until tapped.

### 7.3 Capture First, Organize Later
- The **+** button is always visible (FAB, bottom-right).
- Capture modal: one text field, default = Todo (toggle to Note), submit.
- Default destination: **Inbox** — no need to categorize at capture time.

### 7.4 Forgiveness
- No streaks, no "overdue" red dates, no failure states.
- Completing or deferring a task feels the same — both are wins.
- Reminders use neutral language: *"Hey, you had this on your list: [todo]"*

### 7.5 Energy Awareness
- The energy selector is always visible on Today — a gentle prompt to check in with yourself.
- Setting energy is optional — the app works without it, just less personalized.
- Energy is never judgmental: "low" is not bad, it's information.

---

## 8. Today View — Auto-Suggest Algorithm

The Today view shows up to 5 todos, combining auto-suggestion with manual control.

### Scoring Formula

Each backlog/inbox todo receives a score (higher = more likely to surface):

```
score =
    (due_date_urgency × 40)      # 0–1: overdue=1.0, due today=0.9, tomorrow=0.7, this week=0.4, later=0.1, none=0.2
  + (impact × 8)                  # impact 1–5 → 8–40 points
  + (energy_match × 25)           # 1.0 if matches current energy, 0.5 if adjacent, 0.0 if distant
  + (staleness × 10)              # 0–1: days_in_backlog / 30, capped at 1.0
```

### Manual Overrides
- **Pin**: User pins a todo to Today. Pinned items always show, ranked first. Pinned items do not count toward auto-suggest slots (if you pin 2, the algorithm fills the remaining 3).
- **Dismiss**: User dismisses an auto-suggestion. That todo won't resurface until tomorrow or its score changes significantly (e.g., becomes overdue).

### Energy Matching Detail
Energy levels are ordered: low (0) → medium-low (1) → medium (2) → high (3).
- Exact match: `energy_match = 1.0`
- Off by 1: `energy_match = 0.5`
- Off by 2+: `energy_match = 0.0`
- No energy set (user or task): `energy_match = 0.5` (neutral)

---

## 9. Todo Data Model

```
Todo {
  id: string (uuid)
  title: string
  status: enum [inbox, today_pinned, backlog, deferred, done]
  progress: number (0–100)?
  project: string?
  size: enum [small, medium, large]?
  impact: number (1–5)?
  energy_level: enum [low, medium_low, medium, high]?
  due_date: timestamp?
  supports: string?
  note_id: string?                    ← Links to a Note document
  defer_until: timestamp?
  reminder_at: timestamp?
  dismissed_from_today: timestamp?    ← Prevents re-suggestion until next day
  created_at: timestamp
  updated_at: timestamp
  completed_at: timestamp?
}
```

### Note Data Model

```
Note {
  id: string (uuid)
  title: string
  content: string                     ← Markdown source
  linked_todo_id: string?             ← Optional back-link to a todo
  created_at: timestamp
  updated_at: timestamp
}
```

### Firestore Collections

```
/users/{uid}/todos/{todoId}           ← One document per todo
/users/{uid}/notes/{noteId}           ← One document per note
/users/{uid}/settings/preferences     ← Single doc: energy, theme, notification prefs
```

---

## 10. Sync Strategy

| Concern | Approach |
|---------|----------|
| Storage | Firebase Firestore (free Spark tier) |
| Structure | One document per todo, one document per note |
| Real-time sync | Firestore `onSnapshot` listeners — instant across devices |
| Offline | Firestore persistence enabled (built-in IndexedDB cache) |
| Conflict resolution | Last-write-wins at the document level (single-user, low conflict risk) |
| Auth | Firebase Auth with Google sign-in |
| Free tier limits | 1 GB storage, 50K reads/day, 20K writes/day (far exceeds personal use) |
| Data portability | One-click export: todos as JSON, notes as individual `.md` files |
| AI accessibility | Structured Firestore data; export produces JSON readable by any AI tool |

### Why Not GitHub?
The original PRD proposed GitHub Contents API. This was replaced because:
- Every save = a git commit (noisy, slow, 2 API calls per write)
- No real-time sync (polling only)
- Single `todos.json` file = merge conflict risk across devices
- Rate limits add complexity for a frequently-used personal tool

### Why Not iCloud?
- PWAs on iOS cannot access iCloud files directly
- Would require a native wrapper or sync script
- No real-time push for changes across devices

---

## 11. Technical Architecture

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js (React) | Large ecosystem, strong PWA support, Vercel deploys |
| Hosting | Vercel (free tier) | Zero-config, global CDN, accessible from any device |
| Data | Firebase Firestore | Real-time sync, offline built-in, free tier |
| Auth | Firebase Auth (Google sign-in) | One-tap, secures Firestore rules |
| Offline | Firestore persistence | Built-in IndexedDB cache, no extra code |
| Markdown editor | Milkdown (ProseMirror-based) | WYSIWYG Markdown, keyboard shortcuts, mobile-friendly, lightweight |
| Styling | Tailwind CSS | Fast, consistent, dark mode built-in |
| Notifications | Web Push API | Mac only in v1 (iOS PWA doesn't support) |
| PWA | next-pwa | Service worker, installable on Mac + iPhone |

### Data Flow
```
User action → React state update (optimistic UI)
           → Firestore write (async, real-time)
           → Firestore syncs to other devices via onSnapshot
           → If offline: Firestore caches locally, syncs on reconnect
```

### Firestore Security Rules (Simplified)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## 12. Migration from Coda

### Column Mapping (JW Tasks → Tempo)

| Coda Column | Tempo Field | Notes |
|-------------|------------|-------|
| Task | `title` | Direct |
| Project | `project` | Direct |
| Status: Not started | `status: backlog` | |
| Status: In progress | `status: backlog` | User curates Today post-import |
| Status: Done | `status: done` | |
| Progress | `progress` | Keep as-is (0–100) |
| Size | `size` | small / medium / large |
| Impact (stars) | `impact` | 1–5 integer |
| Energy Level | `energy_level` | low / medium_low / medium / high |
| Due Date | `due_date` | Date parse |
| Supports | `supports` | Free text |

### Migration Steps
1. Export Coda table as CSV.
2. Navigate to **Settings → Import from Coda** in Tempo.
3. Upload CSV; Tempo auto-maps columns using the table above.
4. Preview screen shows row count by status — confirm before committing.
5. All "In progress" items land as `backlog` (not auto-promoted to Today). After import, the Today algorithm surfaces the best candidates and you pin what matters.
6. One-time operation. Coda becomes the archive.

---

## 13. MVP Scope (v1.0)

| Feature | Priority | Notes |
|---------|----------|-------|
| Today view (≤5 auto-suggested todos) | P0 | Core value prop |
| Pin / dismiss on Today | P0 | Manual override for auto-suggest |
| Energy selector + matching | P0 | ADHD differentiator |
| Inbox capture (FAB) | P0 | Must be < 3 sec |
| Complete / defer todo | P0 | |
| Backlog view (collapsed, energy filter) | P0 | |
| WYSIWYG Markdown note editor | P0 | Must be good enough to replace Obsidian |
| Firestore sync (real-time, offline) | P0 | |
| Google sign-in | P0 | |
| PWA installable (Mac + iPhone) | P0 | |
| Link note → todo | P1 | Data model + simple "attach" UI |
| Dark mode | P1 | |
| Soft reminders (Mac only) | P1 | |
| Coda CSV import | P1 | One-time migration |
| Keyboard shortcuts (Mac) | P1 | |
| Data export (JSON + .md) | P1 | Portability + AI readability |
| Brain dump / scratchpad | P2 | |

### v2 Roadmap

| Feature | Priority | Notes |
|---------|----------|-------|
| Floating formatting toolbar (Notes) | P2 | Select text → contextual toolbar with all Markdown options |
| Delete note confirmation | P2 | Simple confirm dialog before permanent delete |
| Celebratory empty states | P2 | More rewarding "All done" / "Inbox zero" moments |
| Backlog filter pill contrast fix | P2 | UX polish — clearer selected vs. unselected state |
| Projects as sidebar folders | P2 | First-class project navigation, not just collapsible groups |
| Habit tracker | P3 | Daily habit tracking with GitHub-style contribution grid |
| Todo visualizations | P3 | Charts: completed by project, on-time, trends over time |
| Voice input + transcription | P3 | Capture by voice, transcribed to text |
| Work/Personal modes | P3 | Isolated contexts with separate databases and mode indicator |
| Recurring todos | P3 | |
| Inline todo syntax in notes | P3 | `- [ ]` in notes auto-syncs to todo list |
| Weekly review screen | P3 | |
| iOS push notifications | P3 | When Apple supports Web Push on PWAs |

---

## 14. Success Metrics

Since this is a personal tool, metrics are qualitative:

- **Daily use without dread** — you open the app and feel calm, not overwhelmed.
- **Capture latency < 3 seconds** — a thought captured before it evaporates.
- **Energy matching feels natural** — you set energy without thinking and the suggestions make sense.
- **No todo left unseen** — Inbox reviews happen naturally (not as a chore).
- **Notes written in Tempo, not elsewhere** — the editor is good enough that you don't miss Obsidian.
- **Data stays yours** — export works, AI tools can read your data.

---

## 15. Open Questions

All previously open questions have been resolved:

| # | Question | Resolution |
|---|----------|------------|
| OQ-1 | iOS PWA file access | Resolved: Firestore handles sync; no file system access needed |
| OQ-2 | Notes and todos same folder? | Resolved: Both in Firestore, separate collections |
| OQ-3 | Web-accessible URL? | Resolved: Vercel hosting |
| OQ-4 | Today view manual or auto? | Resolved: Hybrid — auto-suggest with pin/dismiss |
| OQ-5 | Coda fields/columns? | Resolved: Full mapping complete |
| OQ-6 | Obsidian compatibility? | Resolved: Tempo replaces Obsidian; export provides .md files on demand |

---

## 16. Appendix: Competitive Positioning

| App | Strength | Why not just use it |
|-----|----------|---------------------|
| Coda | Flexible, powerful | Overwhelming, slow mobile, not ADHD-optimized |
| Todoist | Clean, cross-platform | No notes, subscription, no energy matching |
| Obsidian | Great notes + tasks plugin | Full-list view, no Today focus, no real-time sync |
| Things 3 | ADHD-friendly, beautiful | Apple-only, no Markdown notes, no energy matching, $50 |
| Notion | Flexible | Heavy, overwhelming, not ADHD-optimized |
| **Tempo** | Calm focus + energy matching + Markdown notes | **Built exactly for you** |

---

*End of PRD v0.2*
