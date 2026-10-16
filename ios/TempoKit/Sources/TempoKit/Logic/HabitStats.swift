import Foundation

/// Port of `computeHabitStats` in `src/hooks/useHabitStats.ts`.
public struct HabitStats: Hashable, Sendable {
    public var currentStreak: Int
    public var bestStreak: Int
    public var totalCompletions: Int
    /// 0–100: completed days over days since the habit was created, capped at 100.
    public var completionRate: Int
}

public enum HabitStatsCalculator {
    public static func stats(for habit: Habit, now: Date = Date(), calendar: Calendar = .current) -> HabitStats {
        let done = Set(habit.completions.filter(\.value).map(\.key))
        let total = done.count

        // Best streak: consecutive days through the sorted dates.
        var best = 0
        var run = 0
        var previous: Date?
        for key in done.sorted() {
            guard let day = date(key, calendar: calendar) else { continue }
            if let previous, DayMath.daysBetween(previous, day, calendar: calendar) == 1 {
                run += 1
            } else {
                run = 1
            }
            best = max(best, run)
            previous = day
        }

        // Current streak: back from today, or from yesterday if today isn't done yet.
        var cursor = DayMath.startOfDay(now, calendar: calendar)
        if !done.contains(DayMath.isoDateString(cursor, calendar: calendar)) {
            cursor = DayMath.adding(days: -1, to: cursor, calendar: calendar)
        }
        var current = 0
        while done.contains(DayMath.isoDateString(cursor, calendar: calendar)) {
            current += 1
            cursor = DayMath.adding(days: -1, to: cursor, calendar: calendar)
        }

        let daysSinceCreation = max(1, Int((now.timeIntervalSince(habit.createdAt) / 86_400).rounded(.up)))
        let rate = min(100, Int((Double(total) / Double(daysSinceCreation) * 100).rounded()))
        return HabitStats(currentStreak: current, bestStreak: max(best, current), totalCompletions: total, completionRate: rate)
    }

    private static func date(_ key: String, calendar: Calendar) -> Date? {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}
