#if DEBUG
import ActivityKit
import Foundation
import TempoKit
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
/// - `TEMPO_DEBUG_SPARKLE=1` fires every completion sparkle on screen three times, 3 s apart
///   (pair with `TEMPO_DEBUG_SPARKLE_SCALE=<n>` to slow it, `TEMPO_DEBUG_REDUCE_MOTION=1`).
///
/// Mood hooks run from `MoodRow` once it has a client (`runMood`):
/// - `TEMPO_DEBUG_MOOD_SHEET=1` presents the check-in sheet.
/// - `TEMPO_DEBUG_MOOD_HEALTH=1` switches "Also save to Apple Health" on and requests access.
/// - `TEMPO_DEBUG_LOG_MOOD=<value>:<note>` saves a check-in through the sheet's save path.
///
/// Log lines go to the `com.johnwaynehill.Tempo` subsystem, category `debug`.
@MainActor
enum DebugLaunch {
    private static let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "debug")
    private static var ran = false
    private static var moodRan = false

    static func run(model: AppModel, openFocus: () -> Void) async {
        guard !ran else { return }
        ran = true
        let env = ProcessInfo.processInfo.environment

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

        if env["TEMPO_DEBUG_SPARKLE"] == "1" {
            Task {
                for round in 1...3 {
                    try? await Task.sleep(for: .seconds(3))
                    log.info("sparkle: firing debug burst \(round) (scale=\(CompletionSparkle.timeScale), reduceMotionOverride=\(CompletionSparkle.debugReduceMotion))")
                    NotificationCenter.default.post(name: CompletionSparkle.debugNotification, object: nil)
                }
            }
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

    static func runMood(client: TempoClient?, openSheet: () -> Void, onSaved: (MoodEntry) -> Void) async {
        guard !moodRan, let client else { return }
        moodRan = true
        let env = ProcessInfo.processInfo.environment

        if env["TEMPO_DEBUG_MOOD_HEALTH"] == "1" {
            UserDefaults.standard.set(true, forKey: HealthMoodWriter.toggleDefaultsKey)
            let allowed = await HealthMoodWriter.shared.requestAuthorization()
            log.info("mood-health: isHealthDataAvailable=\(HealthMoodWriter.shared.isAvailable) sharingAuthorized=\(allowed)")
        }

        if env["TEMPO_DEBUG_MOOD_SHEET"] == "1" {
            openSheet()
            log.info("mood-sheet: presented the check-in sheet")
        }

        if let raw = env["TEMPO_DEBUG_LOG_MOOD"], !raw.isEmpty {
            let parts = raw.split(separator: ":", maxSplits: 1).map(String.init)
            guard let value = parts.first.flatMap(Int.init) else {
                log.info("log-mood: couldn't parse \"\(raw, privacy: .public)\"")
                return
            }
            let note = parts.count > 1 ? parts[1] : nil
            let alsoHealth = UserDefaults.standard.bool(forKey: HealthMoodWriter.toggleDefaultsKey)
            let outcome = await MoodCheckIn.save(client: client, value: value, note: note, alsoHealth: alsoHealth)
            switch outcome {
            case .saved(let entry, let health):
                onSaved(entry)
                log.info("log-mood: saved \(entry.id.uuidString, privacy: .public) value=\(entry.value) note=\(entry.note ?? "nil", privacy: .public) health=\(String(describing: health), privacy: .public)")
                if health == .saved { await HealthMoodWriter.shared.debugReadBack() }
            case .offline:
                log.info("log-mood: offline")
            case .failed:
                log.info("log-mood: failed")
            }
        }
    }
}
#endif
