import ActivityKit
import Foundation

/// The timer as the system sees it: compiled into both the app (which starts and
/// updates the activity) and the widget extension (which draws it).
struct TempoTimerAttributes: ActivityAttributes {
    var todoId: UUID
    var todoTitle: String
    var estimateMinutes: Int

    struct ContentState: Codable, Hashable {
        /// First start of this run of the timer.
        var startedAt: Date
        /// Seconds banked before `runningSince` (previous stretches of this run).
        var accumulatedSeconds: Int
        /// When the current stretch started; nil while paused.
        var runningSince: Date?
        var isPaused: Bool
    }
}

extension TempoTimerAttributes.ContentState {
    /// The instant a live clock should count from so that it reads
    /// `accumulatedSeconds` plus the current stretch.
    var clockStart: Date? {
        guard !isPaused, let runningSince else { return nil }
        return runningSince.addingTimeInterval(-Double(accumulatedSeconds))
    }

    /// Elapsed seconds at `now`; frozen at `accumulatedSeconds` while paused.
    func elapsedSeconds(at now: Date = Date()) -> Int {
        guard !isPaused, let runningSince else { return accumulatedSeconds }
        return accumulatedSeconds + max(0, Int(now.timeIntervalSince(runningSince)))
    }
}

extension TempoTimerAttributes {
    var estimateSeconds: Int { max(60, estimateMinutes * 60) }
}
