#if DEBUG
import ActivityKit
import Foundation
import os

/// Launch-time hooks for driving the app from the command line, where nothing can
/// tap the simulator. Debug builds only; each is an environment variable read once
/// after Today's first load (see README, "Debug launch hooks"):
///
/// - `TEMPO_DEBUG_CAPTURE=<title>` creates an inbox todo with that title.
/// - `TEMPO_DEBUG_START_TIMER=1` starts the timer on the first Today todo and logs
///   how many Live Activities exist afterwards.
/// - `TEMPO_DEBUG_FOCUS=1` opens Focus Mode.
/// - `TEMPO_DEBUG_COMPLETE_AFTER=<seconds>` calls `completeActive()` after that long.
///
/// Log lines go to the `com.johnwaynehill.Tempo` subsystem, category `debug`.
@MainActor
enum DebugLaunch {
    private static let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "debug")
    private static var ran = false

    static func run(model: AppModel, openFocus: () -> Void) async {
        guard !ran else { return }
        ran = true
        let env = ProcessInfo.processInfo.environment
        await DebugShareHook.run()

        if let title = env["TEMPO_DEBUG_CAPTURE"], !title.isEmpty {
            let todo = await model.createTodo(title: title, status: .inbox)
            log.info("capture: created inbox todo \(todo?.id.uuidString ?? "?", privacy: .public) \"\(title, privacy: .public)\" pending=\(model.pendingCount) offline=\(model.isOffline)")
        }

        if env["TEMPO_DEBUG_START_TIMER"] == "1", !model.timer.isActive {
            if let first = model.todayTodos.first {
                model.startTimer(first.id)
                log.info("start-timer: started \(first.id.uuidString, privacy: .public) \"\(first.title, privacy: .public)\"")
                // The activity request runs on a chained task; give it a moment before counting.
                try? await Task.sleep(for: .seconds(2))
                log.info("Activity<TempoTimerAttributes>.activities.count = \(Activity<TempoTimerAttributes>.activities.count) (enabled=\(ActivityAuthorizationInfo().areActivitiesEnabled))")
            } else {
                log.info("start-timer: nothing on Today")
            }
        }

        if env["TEMPO_DEBUG_FOCUS"] == "1" {
            openFocus()
            log.info("focus: opened Focus Mode")
        }

        if let seconds = env["TEMPO_DEBUG_COMPLETE_AFTER"].flatMap(Int.init), seconds > 0 {
            Task {
                try? await Task.sleep(for: .seconds(seconds))
                let id = model.timer.activeTaskId
                await model.completeActive()
                log.info("complete-after: completed \(id?.uuidString ?? "nothing", privacy: .public) after \(seconds)s; activities=\(Activity<TempoTimerAttributes>.activities.count)")
            }
        }
    }
}
#endif
