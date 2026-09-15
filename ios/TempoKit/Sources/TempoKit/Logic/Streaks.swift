import Foundation

public struct StreakResult: Hashable, Sendable {
    /// Number of consecutive days with at least 1 completion (including today if applicable).
    public var currentStreak: Int
    /// Whether the user has completed at least 1 task today.
    public var hasCompletedToday: Bool

    public init(currentStreak: Int, hasCompletedToday: Bool) {
        self.currentStreak = currentStreak
        self.hasCompletedToday = hasCompletedToday
    }
}

/// Port of `src/hooks/useStreak.ts`.
public enum Streaks {
    /// Streak from the todos' completion timestamps; only `done` todos with a `completedAt` count.
    public static func currentStreak(done todos: [Todo], now: Date = Date(), calendar: Calendar = .current) -> StreakResult {
        currentStreak(completions: todos.compactMap { $0.status == .done ? $0.completedAt : nil }, now: now, calendar: calendar)
    }

    /// Streak from raw completion timestamps.
    public static func currentStreak(completions: [Date], now: Date = Date(), calendar: Calendar = .current) -> StreakResult {
        let today = DayMath.startOfDay(now, calendar: calendar)
        let hasCompletedToday = completions.contains { $0 >= today }

        // Walk backward from today (or yesterday if nothing done today yet)
        var streak = hasCompletedToday ? 1 : 0
        var cursor = DayMath.adding(days: -1, to: today, calendar: calendar)

        for _ in 0..<365 {
            let dayHasCompletion = completions.contains { DayMath.isSameDay($0, cursor, calendar: calendar) }
            if !dayHasCompletion { break }
            streak += 1
            cursor = DayMath.adding(days: -1, to: cursor, calendar: calendar)
        }

        return StreakResult(currentStreak: streak, hasCompletedToday: hasCompletedToday)
    }
}
