import AppIntents
import Foundation
import TempoKit

/// "What's on Today": reads the cached day aloud and hands the titles to Shortcuts.
/// Works offline and without opening the app; it reports what the app last synced.
struct WhatsOnTodayIntent: AppIntent {
    static let title: LocalizedStringResource = "What's on Today"
    static let description = IntentDescription("Tells you what's left on Today and when you'd be done.")
    static let supportedModes: IntentModes = .background

    init() {}

    func perform() async throws -> some IntentResult & ReturnsValue<[String]> & ProvidesDialog {
        let now = Date()
        guard let key = TodayWidgetData.apiKey() else {
            return .result(value: [], dialog: "Open Tempo and sign in first.")
        }
        guard let snapshot = await TodayWidgetData.snapshot(apiKey: key) else {
            return .result(value: [], dialog: "Open Tempo once so it can load Today.")
        }
        let todos = TodayWidgetData.todayTodos(in: snapshot, now: now)
        let timer = TodayWidgetData.sharedTimer(now: now)
        let running = timer.activeTaskId.flatMap { id in todos.contains { $0.id == id } ? timer.snapshot(at: now) : nil }
        let end = TimeMath.projectedEndTime(todos, timer: running, now: now)
        let titles = todos.map(\.title)
        let sentence = TodaySpeech.sentence(titles: titles, projectedEnd: end)
        IntentLog.logger.info("today: \(sentence, privacy: .public)")
        return .result(value: titles, dialog: "\(sentence)")
    }
}

enum TodaySpeech {
    /// "3 tasks left: A, B and C. Done by about 4:30 PM." Past three titles: "A, B, C and 2 more".
    static func sentence(titles: [String], projectedEnd: Date, calendar: Calendar = .current) -> String {
        guard !titles.isEmpty else { return "Nothing on Today. Enjoy the quiet." }
        let count = "\(titles.count) task\(titles.count == 1 ? "" : "s") left"
        return "\(count): \(list(titles)). Done by about \(TimeMath.formatClock(projectedEnd, calendar: calendar))."
    }

    static func list(_ titles: [String], limit: Int = 3) -> String {
        let shown = Array(titles.prefix(limit))
        let extra = titles.count - shown.count
        if extra > 0 {
            return shown.joined(separator: ", ") + " and \(extra) more"
        }
        guard shown.count > 1 else { return shown.first ?? "" }
        return shown.dropLast().joined(separator: ", ") + " and " + shown[shown.count - 1]
    }
}
