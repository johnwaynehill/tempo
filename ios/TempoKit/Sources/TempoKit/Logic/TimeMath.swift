import Foundation

/// Anything with an estimate (mirrors `Estimable` in `src/lib/time.ts`).
public protocol Estimable {
    var estimatedMinutes: Int? { get }
    var size: TodoSize? { get }
}

/// What the projection needs to know about the running timer.
public struct TimerSnapshot: Hashable, Sendable {
    public var activeTaskId: UUID?
    public var elapsedSeconds: Int

    public init(activeTaskId: UUID?, elapsedSeconds: Int) {
        self.activeTaskId = activeTaskId
        self.elapsedSeconds = elapsedSeconds
    }
}

/// Port of `src/lib/time.ts`: time-estimate math shared by Today, Focus Mode, and Plan My Day.
public enum TimeMath {
    /// Runs shorter than this are accidental taps, not work.
    public static let minRunSeconds = 30

    /// Default estimate by todo size, used when the user hasn't set one.
    public static func defaultEstimate(_ size: TodoSize?) -> Int {
        switch size {
        case .small: 15
        case .medium: 30
        case .large: 60
        case nil: 25
        }
    }

    public static func getEstimate(_ todo: some Estimable) -> Int {
        todo.estimatedMinutes ?? defaultEstimate(todo.size)
    }

    public static func totalEstimatedMinutes(_ todos: [some Estimable]) -> Int {
        todos.reduce(0) { $0 + getEstimate($1) }
    }

    /// Seconds of planned work left across `todos`. The active task contributes whatever
    /// is left of its own estimate (never negative, so running over on one task doesn't
    /// eat into the others); every other task contributes its full estimate.
    public static func remainingSeconds<T: Estimable & Identifiable>(
        _ todos: [T], timer: TimerSnapshot?
    ) -> Int where T.ID == UUID {
        var seconds = 0
        for todo in todos {
            let estimate = getEstimate(todo) * 60
            if let timer, timer.activeTaskId == todo.id {
                seconds += max(0, estimate - timer.elapsedSeconds)
            } else {
                seconds += estimate
            }
        }
        return seconds
    }

    public static func remainingMinutes<T: Estimable & Identifiable>(
        _ todos: [T], timer: TimerSnapshot?
    ) -> Int where T.ID == UUID {
        let seconds = remainingSeconds(todos, timer: timer)
        return (seconds + 59) / 60
    }

    /// When the day's remaining work would finish if it started now and ran back to back.
    public static func projectedEndTime<T: Estimable & Identifiable>(
        _ todos: [T], timer: TimerSnapshot?, now: Date = Date()
    ) -> Date where T.ID == UUID {
        now.addingTimeInterval(TimeInterval(remainingSeconds(todos, timer: timer)))
    }

    /// Minutes a timer run adds to a todo's `actualMinutes`; 0 when too short to count.
    public static func minutesToRecord(elapsedSeconds: Int) -> Int {
        if elapsedSeconds < minRunSeconds { return 0 }
        return max(1, jsRound(Double(elapsedSeconds) / 60))
    }

    /// "4:37 PM" — built by hand so it matches the web client regardless of locale.
    public static func formatClock(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        let hour = c.hour ?? 0
        let minute = c.minute ?? 0
        let h12 = hour % 12 == 0 ? 12 : hour % 12
        return "\(h12):\(String(format: "%02d", minute)) \(hour < 12 ? "AM" : "PM")"
    }

    /// Seconds as "12:45" or "1:02:30".
    public static func formatElapsed(_ seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        if h > 0 { return "\(h):\(String(format: "%02d", m)):\(String(format: "%02d", s))" }
        return "\(m):\(String(format: "%02d", s))"
    }

    /// Minutes as "1h 30m" or "25m".
    public static func formatMinutes(_ mins: Int) -> String {
        if mins >= 60 {
            let h = mins / 60
            let m = mins % 60
            return m > 0 ? "\(h)h \(m)m" : "\(h)h"
        }
        return "\(mins)m"
    }

    /// JavaScript `Math.round`: halves round toward +∞.
    static func jsRound(_ x: Double) -> Int {
        Int((x + 0.5).rounded(.down))
    }
}
