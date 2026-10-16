import AppIntents
import Foundation
import SwiftUI
import TempoKit
import WidgetKit

/// Marks a habit done or not-done for a day, from the Habits widget's row buttons. A plain
/// background `AppIntent` — not a `LiveActivityIntent` like Start Next or Complete — because
/// nothing here needs the app in the foreground, so a tap doesn't launch it.
struct ToggleHabitWidgetIntent: AppIntent {
    static let title: LocalizedStringResource = "Toggle Habit"
    static let description = IntentDescription("Marks a habit done or not done for today.")
    static let supportedModes: IntentModes = .background

    /// String, not `UUID` — `AppIntent` parameters stick to the primitive types Siri/Shortcuts
    /// know how to display, and this one is never surfaced there anyway (always constructed
    /// with the initializer below, one per widget row).
    @Parameter(title: "Habit ID")
    var habitId: String
    @Parameter(title: "Date")
    var date: String
    @Parameter(title: "Completed")
    var completed: Bool

    init() {
        habitId = ""
        date = ""
        completed = false
    }

    init(habitId: UUID, date: String, completed: Bool) {
        self.habitId = habitId.uuidString
        self.date = date
        self.completed = completed
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        guard let id = UUID(uuidString: habitId) else { return .result() }

        // The widget bakes its day into each button when the timeline is built. Past midnight a
        // stale render would otherwise toggle yesterday while showing yesterday's checkmarks as
        // today's; skip the write and let the reload below redraw with the new day.
        guard date == DayMath.isoDateString(Date()) else {
            WidgetCenter.shared.reloadAllTimelines()
            return .result()
        }

        // Instant feedback: WidgetKit reloads this widget's own timeline once perform()
        // returns, so recording the override before doing anything else means that reload
        // already shows the new state, before the real write below even finishes.
        HabitsWidgetData.setOverride(habitId: id, date: date, completed: completed)

        if let host = TempoIntentBridge.host {
            await host.toggleHabit(id: id, date: date, completed: completed)
            IntentLog.logger.info("toggleHabit (app model): \(id.uuidString, privacy: .public) \(date, privacy: .public) -> \(completed)")
        } else {
            await ToggleHabitStandalone.run(habitId: id, date: date, completed: completed)
            IntentLog.logger.info("toggleHabit (standalone): \(id.uuidString, privacy: .public) \(date, privacy: .public) -> \(completed)")
        }
        // Not `reloadTimelines(ofKind:)`: the `HabitsWidget` type lives only in the widget
        // extension's sources, not the app target this file also compiles into.
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

/// Toggle without the app model: a quick direct write, with the offline inbox as fallback —
/// same shape as `AddTodoStandalone`.
enum ToggleHabitStandalone {
    static func run(habitId: UUID, date: String, completed: Bool) async {
        guard let key = TodayWidgetData.apiKey() else { return }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 5
        configuration.timeoutIntervalForResource = 8
        configuration.waitsForConnectivity = false
        let session = URLSession(configuration: configuration)
        defer { session.finishTasksAndInvalidate() }

        let client = TempoClient(baseURL: TodayWidgetData.baseURL(), apiKey: key, session: session)
        // The inbox record is written whether or not the network call lands: it is what keeps the
        // widget's view of the habit right until the app next syncs (the toggle is idempotent, so
        // the app re-sending it on import is harmless), and it is the retry if the call fails.
        if let inbox = AppGroup.inboxURL {
            do {
                try PendingOpInbox(directory: inbox).write(.toggleHabit(habitId: habitId, date: date, completed: completed))
            } catch {
                IntentLog.logger.error("toggleHabit: couldn't write to the inbox: \(String(describing: error), privacy: .public)")
            }
        }
        _ = try? await client.toggleHabit(id: habitId, date: date, completed: completed)
    }
}

/// The widget's per-row toggle button.
struct ToggleHabitWidgetButton: View {
    let habitId: UUID
    let date: String
    let completedToday: Bool

    var body: some View {
        Button(intent: ToggleHabitWidgetIntent(habitId: habitId, date: date, completed: !completedToday)) {
            HabitToggleCircle(completedToday: completedToday)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(completedToday ? "Mark habit incomplete" : "Mark habit complete")
    }
}
