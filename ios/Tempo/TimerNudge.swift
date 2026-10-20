import Foundation
import os
import TempoKit
import UserNotifications

/// A gentle local notification when the task on the clock runs well past its estimate:
/// a quarter of the estimate over, and at least 10 minutes. Rescheduled on every timer change
/// (start, pause, resume, stop), so it only ever exists for a running clock.
@MainActor
enum TimerNudge {
    static let identifier = "timer-overrun"

    static func graceMinutes(estimate: Int) -> Int {
        max(10, estimate / 4)
    }

    static func sync(timer: TimerState, todo: Todo?, now: Date = Date()) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        guard timer.isRunning, let todo else { return }

        let estimate = TimeMath.getEstimate(todo)
        let grace = graceMinutes(estimate: estimate)
        let fireIn = TimeInterval((estimate + grace) * 60 - timer.elapsedSeconds(at: now))
        // Already that far over (a long pause resumed late, say): don't nag on the spot.
        guard fireIn > 0 else { return }

        let content = UNMutableNotificationContent()
        content.title = "Still on \(todo.title)?"
        content.body = "About \(TimeMath.formatMinutes(estimate + grace)) so far, against a \(TimeMath.formatMinutes(estimate)) estimate. Keep going, take a break, or switch: your call."
        content.sound = .default
        content.threadIdentifier = "timer"
        content.userInfo = ["kind": "timer", "todoId": todo.id.uuidString.lowercased()]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: fireIn, repeats: false)
        center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
        Logger(subsystem: "com.johnwaynehill.Tempo", category: "push")
            .info("timer nudge: in \(Int(fireIn))s for \(todo.id.uuidString, privacy: .public)")
    }
}
