import ActivityKit
import AppIntents
import SwiftUI
import TempoKit
import WidgetKit

/// "Complete task": finishes whatever's on the clock, banking the run's minutes. A
/// `LiveActivityIntent`, so a tap on the widget's Complete button runs it in the app's process
/// (launched in the background if needed), where it may end the Live Activity.
struct CompleteActiveTaskIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Complete Task"
    static let description = IntentDescription("Completes the task on the clock and stops the timer.")

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let outcome: CompleteActiveOutcome
        if let host = TempoIntentBridge.host, let inApp = await host.completeActiveTask() {
            outcome = inApp
            IntentLog.logger.info("completeActive (app model): \(outcome.logDescription, privacy: .public)")
        } else {
            outcome = await CompleteActiveStandalone.run()
            IntentLog.logger.info("completeActive (shared container): \(outcome.logDescription, privacy: .public)")
            TempoIntentBridge.host?.adoptSharedTimer()
        }
        WidgetCenter.shared.reloadAllTimelines()
        return .result(dialog: "\(outcome.dialog)")
    }
}

/// Complete without the app model: everything the app would do, written where the app reads it.
enum CompleteActiveStandalone {
    static func run(now: Date = Date(), calendar: Calendar = .current) async -> CompleteActiveOutcome {
        guard let key = TodayWidgetData.apiKey() else { return .signedOut }

        let timer = TodayWidgetData.sharedTimer(now: now, calendar: calendar)
        guard let id = timer.activeTaskId else { return .nothingActive }

        let snapshot = await TodayWidgetData.snapshot(apiKey: key)
        let title = snapshot?.todo(id: id)?.title ?? "your task"
        let priorActualMinutes = snapshot?.todo(id: id)?.actualMinutes

        // 1. Stop and bank the run, same math as `AppModel.stopTimer`.
        let result = TaskTimer.stopResult(state: timer, priorActualMinutes: priorActualMinutes, at: now)
        if let data = try? TempoJSON.encoder.encode(result.state) {
            AppGroup.defaults.set(data, forKey: AppGroup.timerStateKey)
        }

        // 2. End the Live Activity — nothing left on the clock.
        for existing in Activity<TempoTimerAttributes>.activities {
            await existing.end(nil, dismissalPolicy: .immediate)
        }

        // 3. The completion itself, with the run's minutes when it counted.
        if let inbox = AppGroup.inboxURL {
            do {
                let actualMinutes = result.minutesThisRun > 0 ? result.actualMinutes : nil
                try PendingOpInbox(directory: inbox).write(.completeTodo(todoId: id, actualMinutes: actualMinutes))
            } catch {
                IntentLog.logger.error("completeActive: couldn't write completion to the inbox: \(String(describing: error), privacy: .public)")
            }
        }
        return .completed(title: title)
    }
}

/// The widget's Complete button (and the gallery's).
struct CompleteActiveWidgetButton: View {
    var body: some View {
        Button(intent: CompleteActiveTaskIntent()) {
            TodayWidgetCompleteLabel()
        }
        .buttonStyle(.plain)
    }
}
