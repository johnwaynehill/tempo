import Foundation
import Observation
import TempoKit

/// Loads and shapes everything the Today screen shows. Read-only in Phase 1.
@Observable @MainActor
final class TodayViewModel {
    private(set) var todayTodos: [Todo] = []
    private(set) var todayEvents: [CalendarEvent] = []
    private(set) var isLoading = false
    private(set) var hasLoaded = false
    var error: String?

    private let client: TempoClient
    private let calendar: Calendar
    /// Only ask the server to generate once per day per launch, even if the set stays empty.
    private var generatedFor: String?

    init(client: TempoClient, calendar: Calendar = .current) {
        self.client = client
        self.calendar = calendar
    }

    // MARK: Derived

    struct Summary: Equatable {
        var taskCount: Int
        var remainingMinutes: Int
        var projectedEnd: Date

        var line: String {
            let tasks = "\(taskCount) task\(taskCount == 1 ? "" : "s")"
            return "\(tasks) · \(TimeMath.formatMinutes(remainingMinutes)) · done by ~\(TimeMath.formatClock(projectedEnd))"
        }
    }

    var summary: Summary? {
        guard !todayTodos.isEmpty else { return nil }
        return Summary(
            taskCount: todayTodos.count,
            remainingMinutes: TimeMath.remainingMinutes(todayTodos, timer: nil),
            projectedEnd: TimeMath.projectedEndTime(todayTodos, timer: nil)
        )
    }

    var todayString: String {
        TodayResolution.todayDateString(now: Date(), calendar: calendar)
    }

    // MARK: Loading

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        await reload()
    }

    func reload() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        let today = todayString
        do {
            async let todosTask = client.todos()
            async let setTask = client.todaySet(date: today)
            async let eventsTask = client.events()

            let todos = try await todosTask
            var set = try await setTask
            let events = try await eventsTask

            // A day with no row yet (`exists: false`) gets its set built by the server;
            // an empty but existing set is the user's doing and stays empty.
            if !set.isGenerated, generatedFor != today {
                generatedFor = today
                _ = try await client.generateTodaySet(date: today)
                set = try await client.todaySet(date: today)
            }

            let pinned = todos.filter { $0.status == .todayPinned }
            todayTodos = TodayResolution.resolveTodayTodos(
                todaySet: set, todos: todos, pinned: pinned, today: today
            )
            todayEvents = Self.eventsForToday(events, now: Date(), calendar: calendar)
            error = nil
            hasLoaded = true
        } catch let apiError as TempoAPIError {
            self.error = Self.describe(apiError)
        } catch _ {
            self.error = "Something went wrong loading Today."
        }
    }

    // MARK: Helpers

    /// Events starting on the same local day as `now`; all-day first, then by start time.
    static func eventsForToday(_ events: [CalendarEvent], now: Date, calendar: Calendar) -> [CalendarEvent] {
        events
            .filter { calendar.isDate($0.startTime, inSameDayAs: now) }
            .sorted { a, b in
                if a.allDay != b.allDay { return a.allDay }
                return a.startTime < b.startTime
            }
    }

    private static func describe(_ error: TempoAPIError) -> String {
        switch error {
        case .unauthorized: "Your API key was rejected. Sign out and paste a fresh one."
        case .transport: "Couldn't reach Tempo. Pull to try again."
        case .http(let status, _): "Tempo answered with an error (\(status))."
        case .decoding, .invalidResponse: "Tempo sent something unexpected."
        }
    }
}
