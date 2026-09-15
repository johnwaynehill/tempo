import ActivityKit
import AppIntents
import SwiftUI
import TempoKit
import WidgetKit

/// "Start next task": puts Today's first task on the clock. A `LiveActivityIntent`, so a tap on
/// the widget's Start next button runs it in the app's process (launched in the background if
/// needed), where it may start the Live Activity.
struct StartNextTaskIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Start Next Task"
    static let description = IntentDescription("Starts the timer on the first task on Today.")

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let outcome: StartNextOutcome
        if let host = TempoIntentBridge.host, let inApp = await host.startNextTask() {
            outcome = inApp
            IntentLog.logger.info("startNext (app model): \(outcome.logDescription, privacy: .public)")
        } else {
            outcome = await StartNextStandalone.run()
            IntentLog.logger.info("startNext (shared container): \(outcome.logDescription, privacy: .public)")
            // A model that exists but hadn't loaded yet still has to show the new clock.
            TempoIntentBridge.host?.adoptSharedTimer()
        }
        WidgetCenter.shared.reloadAllTimelines()
        return .result(dialog: "\(outcome.dialog)")
    }
}

/// Start next without the app model: everything the app would do, written where the app reads it.
enum StartNextStandalone {
    static func run(now: Date = Date(), calendar: Calendar = .current) async -> StartNextOutcome {
        guard let key = TodayWidgetData.apiKey() else { return .signedOut }
        guard let snapshot = await TodayWidgetData.snapshot(apiKey: key) else { return .nothingToday }

        let timer = TodayWidgetData.sharedTimer(now: now, calendar: calendar)
        if let id = timer.activeTaskId {
            return .alreadyRunning(title: snapshot.todo(id: id)?.title ?? "your task")
        }
        guard let first = TodayWidgetData.todayTodos(in: snapshot, now: now, calendar: calendar).first else {
            return .nothingToday
        }

        // 1. The clock, where AppModel restores it from on launch and foreground.
        let state = TimerState.idle.starting(first.id, at: now)
        if let data = try? TempoJSON.encoder.encode(state) {
            AppGroup.defaults.set(data, forKey: AppGroup.timerStateKey)
        }

        // 2. The Live Activity, with the same attributes the app uses.
        await startLiveActivity(
            attributes: TempoTimerAttributes(todoId: first.id, todoTitle: first.title, estimateMinutes: TimeMath.getEstimate(first)),
            state: TempoTimerAttributes.ContentState(startedAt: now, accumulatedSeconds: 0, runningSince: now, isPaused: false)
        )

        // 3. `startedAt` on the todo, the first time only; the app imports and sends it.
        if let patch = TaskTimer.startPatch(for: first, at: now), let inbox = AppGroup.inboxURL {
            do {
                try PendingOpInbox(directory: inbox).write(.updateTodo(todoId: first.id, patch: patch))
            } catch {
                IntentLog.logger.error("startNext: couldn't write startedAt to the inbox: \(String(describing: error), privacy: .public)")
            }
        }
        return .started(title: first.title)
    }

    /// Replaces any timer activity with one for the new task. Nonisolated because `Activity`
    /// isn't `Sendable`; ActivityKit serialises the calls itself.
    private static func startLiveActivity(attributes: TempoTimerAttributes, state: TempoTimerAttributes.ContentState) async {
        for existing in Activity<TempoTimerAttributes>.activities {
            await existing.end(nil, dismissalPolicy: .immediate)
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        do {
            _ = try Activity.request(attributes: attributes, content: ActivityContent(state: state, staleDate: nil), pushType: nil)
        } catch {
            IntentLog.logger.error("startNext: Live Activity request failed: \(String(describing: error), privacy: .public)")
        }
    }
}

/// The widget's Start next button (and the gallery's).
struct StartNextWidgetButton: View {
    var body: some View {
        Button(intent: StartNextTaskIntent()) {
            TodayWidgetStartLabel()
        }
        .buttonStyle(.plain)
    }
}
