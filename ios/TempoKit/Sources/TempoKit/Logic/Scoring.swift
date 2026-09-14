import Foundation

/// Port of `src/lib/scoring.ts`: the Today auto-suggest scoring algorithm.
///
///     score =
///       (due_date_urgency × 40)   // 0–1 scale
///     + (impact × 8)              // impact 1–5 → 8–40 points
///     + (energy_match × 25)       // 1.0 if matches, 0.5 if adjacent, 0.0 if distant
///     + (staleness × 10)          // days_in_backlog / 30, capped at 1.0
public enum Scoring {
    /// Projects whose todos should never be suggested for Today *before* their due date
    /// (not urgent yet), but are guaranteed on it — and every day after, until they're
    /// done. An overdue chore is the one thing that must not quietly fall off Today.
    /// Case-insensitive, trimmed compare. Mirrors `api/src/lib/autoplan.ts`. Applied in
    /// `suggestTodayTodos` only, not `scoreTodo`.
    public static let DUE_DATE_GATED_PROJECTS: Set<String> = ["chore"]

    public static func isDueDateGatedProject(_ project: String?) -> Bool {
        guard let project else { return false }
        let key = project.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return !key.isEmpty && DUE_DATE_GATED_PROJECTS.contains(key)
    }

    public static func dueDateUrgency(_ dueDate: Date?, now: Date = Date(), calendar: Calendar = .current) -> Double {
        guard let dueDate else { return 0.2 } // No due date gets a neutral score
        let daysUntil = DayMath.daysBetween(now, dueDate, calendar: calendar)
        if daysUntil < 0 { return 1.0 }   // Overdue
        if daysUntil == 0 { return 1.0 }  // Due today
        if daysUntil == 1 { return 0.7 }  // Tomorrow
        if daysUntil <= 7 { return 0.4 }  // This week
        return 0.1                        // Later
    }

    public static func energyMatch(_ taskEnergy: EnergyLevel?, _ currentEnergy: EnergyLevel?) -> Double {
        guard let taskEnergy, let currentEnergy else { return 0.5 } // Neutral if either is unset
        let distance = abs(taskEnergy.ordinal - currentEnergy.ordinal)
        if distance == 0 { return 1.0 }
        if distance == 1 { return 0.5 }
        return 0.0
    }

    public static func staleness(_ createdAt: Date, now: Date = Date()) -> Double {
        let days = now.timeIntervalSince(createdAt) / 86_400
        return min(days / 30, 1.0)
    }

    public static func scoreTodo(_ todo: Todo, currentEnergy: EnergyLevel? = nil, now: Date = Date(), calendar: Calendar = .current) -> Double {
        dueDateUrgency(todo.dueDate, now: now, calendar: calendar) * 40
            + Double(todo.impact ?? 3) * 8
            + energyMatch(todo.energyLevel, currentEnergy) * 25
            + staleness(todo.createdAt, now: now) * 10
    }

    /// Returns up to `limit` auto-suggested todos, sorted by score descending.
    /// Excludes: done, deferred (not yet due), today_pinned, dismissed today, inbox.
    ///
    /// `DUE_DATE_GATED_PROJECTS` todos (e.g. Chore) get two rules, not one: excluded
    /// entirely until their due date arrives, and from that date onward — including once
    /// overdue — they're **mandatory**: guaranteed in the result rather than left to
    /// compete for a slot on score alone. Mandatory items are additive on top of `limit`,
    /// so the result can exceed it when several chores are outstanding. Mirrors
    /// `selectCandidates` in `api/src/lib/autoplan.ts`.
    public static func suggestTodayTodos(
        _ todos: [Todo],
        currentEnergy: EnergyLevel? = nil,
        pinnedCount: Int = 0,
        limit: Int = 5,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> [Todo] {
        let today = DayMath.startOfDay(now, calendar: calendar)

        let candidates = todos.filter { t in
            if t.status == .done || t.status == .todayPinned { return false }
            if t.status == .inbox { return false }
            if t.status == .deferred, let deferUntil = t.deferUntil, deferUntil > now { return false }
            if let dismissed = t.dismissedFromToday, dismissed >= today { return false }

            if isDueDateGatedProject(t.project) {
                guard let dueDate = t.dueDate else { return false }
                let due = DayMath.startOfDay(dueDate, calendar: calendar)
                if due > today { return false }
            }
            return true
        }

        // Every gated todo that survived the filter is, by construction, due today or
        // overdue — split those out as mandatory before scoring/slicing the rest.
        // Oldest due date first, so the most overdue chore leads.
        let mandatory = candidates
            .filter { isDueDateGatedProject($0.project) }
            .sorted { ($0.dueDate?.timeIntervalSince1970 ?? 0) < ($1.dueDate?.timeIntervalSince1970 ?? 0) }
        let discretionary = candidates.filter { !isDueDateGatedProject($0.project) }

        let scored = discretionary
            .map { (todo: $0, score: scoreTodo($0, currentEnergy: currentEnergy, now: now, calendar: calendar)) }
            .sorted { $0.score > $1.score }

        let slotsAvailable = max(0, limit - pinnedCount - mandatory.count)
        return mandatory + scored.prefix(slotsAvailable).map(\.todo)
    }
}
