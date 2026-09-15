import ActivityKit
import Foundation

/// Owns the timer's Live Activity. Not called yet: the pass that wires
/// `TimerState` starts, updates, and ends it as the timer changes.
///
/// `Activity` isn't `Sendable`, so its async `update`/`end` calls run from
/// nonisolated methods rather than being sent off the main actor; ActivityKit
/// serialises the calls itself.
@MainActor
final class TimerActivityController {
    nonisolated(unsafe) private(set) var activity: Activity<TempoTimerAttributes>?

    var isActive: Bool { activity != nil }

    /// Whether the user allows Live Activities at all (Settings → Tempo → Live Activities).
    var isAvailable: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    /// Starts an activity for the task, replacing any previous one.
    func start(attributes: TempoTimerAttributes, state: TempoTimerAttributes.ContentState) async throws {
        guard isAvailable else { return }
        await end()
        activity = try Activity.request(
            attributes: attributes,
            content: ActivityContent(state: state, staleDate: nil),
            pushType: nil
        )
    }

    nonisolated func update(state: TempoTimerAttributes.ContentState) async {
        await activity?.update(ActivityContent(state: state, staleDate: nil))
    }

    /// Ends and dismisses the activity right away; a stopped timer has nothing to show.
    nonisolated func end() async {
        guard let activity else { return }
        await activity.end(nil, dismissalPolicy: .immediate)
        self.activity = nil
    }

    /// Adopts an activity left over from a previous launch so it can be updated or ended.
    func adoptExisting() {
        activity = Activity<TempoTimerAttributes>.activities.first
    }
}
