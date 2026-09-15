import Foundation
import TempoKit
import WidgetKit

/// What the Today widget, the App Intents and the debug widget gallery know about the day,
/// read without the app running: the API key from the shared Keychain, the cached
/// `CacheSnapshot` from the App Group, and the timer from the App Group's defaults.
/// Nothing here talks to the network.
enum TodayWidgetData {
    /// The signed-in API key, or nil when signed out (or the Keychain group isn't reachable).
    static func apiKey() -> String? {
        guard let key = Keychain.read(AppGroup.apiKeyKeychainKey), !key.isEmpty else { return nil }
        return key
    }

    /// The server the app signed in against; production when it never said.
    static func baseURL() -> URL {
        Keychain.read(AppGroup.baseURLKeychainKey).flatMap(URL.init(string:)) ?? TempoClient.productionURL
    }

    /// The app's cached snapshot for `apiKey`, read through `TempoStore` (no network call).
    /// Nil when there is no App Group container or the app has never finished a refresh.
    static func snapshot(apiKey: String) async -> CacheSnapshot? {
        guard let directory = AppGroup.accountDirectory(forAPIKey: apiKey) else { return nil }
        let store = TempoStore(
            client: TempoClient(baseURL: baseURL(), apiKey: apiKey),
            directory: directory
        )
        let snapshot = await store.snapshot
        return snapshot.lastRefresh == nil ? nil : snapshot
    }

    /// The timer the app (or `StartNextTaskIntent`) last saved; `.idle` when none or when it
    /// started on another day, which the app discards too.
    static func sharedTimer(now: Date = Date(), calendar: Calendar = .current) -> TimerState {
        guard let data = AppGroup.defaults.data(forKey: AppGroup.timerStateKey),
              let state = try? TempoJSON.decoder.decode(TimerState.self, from: data),
              !state.isStale(at: now, calendar: calendar)
        else { return .idle }
        return state
    }

    /// Today's list exactly as `AppModel.todayTodos` builds it: pinned first, then the day's set.
    static func todayTodos(in snapshot: CacheSnapshot, now: Date = Date(), calendar: Calendar = .current) -> [Todo] {
        let today = TodayResolution.todayDateString(now: now, calendar: calendar)
        return TodayResolution.resolveTodayTodos(
            todaySet: snapshot.todaySets[today],
            todos: snapshot.todos,
            pinned: snapshot.todos.filter { $0.status == .todayPinned },
            today: today
        )
    }

    /// Todos completed since local midnight (mirrors `AppModel.completedTodayCount`).
    static func completedTodayCount(in snapshot: CacheSnapshot, now: Date = Date(), calendar: Calendar = .current) -> Int {
        let start = DayMath.startOfDay(now, calendar: calendar)
        return snapshot.todos.filter { $0.status == .done && ($0.completedAt ?? .distantPast) >= start }.count
    }

    // MARK: Entries

    /// The entry for right now.
    static func entry(now: Date = Date(), calendar: Calendar = .current) async -> TodayWidgetEntry {
        await timeline(now: now, minutes: 1, calendar: calendar).first ?? TodayWidgetEntry(date: now, content: .signedOut)
    }

    /// One entry a minute for `minutes` minutes, so "done by ~4:30 PM" keeps up with the clock
    /// between the 15-minute refreshes. The data is read once; only the projection moves.
    static func timeline(now: Date = Date(), minutes: Int = 15, calendar: Calendar = .current) async -> [TodayWidgetEntry] {
        guard let key = apiKey() else { return [TodayWidgetEntry(date: now, content: .signedOut)] }
        guard let snapshot = await snapshot(apiKey: key) else { return [TodayWidgetEntry(date: now, content: .notLoaded)] }

        let todos = todayTodos(in: snapshot, now: now, calendar: calendar)
        guard !todos.isEmpty else {
            return [TodayWidgetEntry(date: now, content: .empty(completedToday: completedTodayCount(in: snapshot, now: now, calendar: calendar)))]
        }

        let timer = sharedTimer(now: now, calendar: calendar)
        // Like `AppModel.activeTodo`: the clock only counts while its todo is still on Today.
        let active = timer.activeTaskId.flatMap { id in todos.first { $0.id == id } }
        let tasks = todos.map(TodayWidgetTask.init)

        return (0..<max(1, minutes)).map { offset in
            let date = now.addingTimeInterval(TimeInterval(offset * 60))
            let snapshotAtDate = active == nil ? nil : timer.snapshot(at: date)
            let clock = active.map { todo in
                TodayWidgetClock(
                    task: TodayWidgetTask(todo),
                    startedAt: timer.startedAt ?? now,
                    accumulatedSeconds: timer.accumulatedSeconds,
                    runningSince: timer.runningSince
                )
            }
            return TodayWidgetEntry(date: date, content: .tasks(TodayWidgetTasks(
                tasks: tasks,
                remainingMinutes: TimeMath.remainingMinutes(todos, timer: snapshotAtDate),
                projectedEnd: TimeMath.projectedEndTime(todos, timer: snapshotAtDate, now: date),
                clock: clock
            )))
        }
    }
}

/// One row of the widget: just what the views draw.
struct TodayWidgetTask: Hashable, Sendable, Identifiable {
    var id: UUID
    var title: String
    var estimateMinutes: Int

    init(id: UUID, title: String, estimateMinutes: Int) {
        self.id = id
        self.title = title
        self.estimateMinutes = estimateMinutes
    }

    init(_ todo: Todo) {
        self.init(id: todo.id, title: todo.title, estimateMinutes: TimeMath.getEstimate(todo))
    }
}

/// The task on the clock, in the same timestamps `TimerState` keeps, so the widget can draw a
/// live `Text(timerInterval:)` that the system ticks without new timeline entries.
struct TodayWidgetClock: Hashable, Sendable {
    var task: TodayWidgetTask
    var startedAt: Date
    var accumulatedSeconds: Int
    var runningSince: Date?

    var isPaused: Bool { runningSince == nil }

    /// Where a count-up clock should start so it reads the banked seconds plus this stretch.
    var clockStart: Date? {
        runningSince.map { $0.addingTimeInterval(-Double(accumulatedSeconds)) }
    }

    var estimateSeconds: Int { max(60, task.estimateMinutes * 60) }
}

struct TodayWidgetTasks: Hashable, Sendable {
    /// Everything left on Today, the task on the clock included, in Today's order.
    var tasks: [TodayWidgetTask]
    var remainingMinutes: Int
    var projectedEnd: Date
    var clock: TodayWidgetClock?

    /// "3 tasks · 1h 10m · done by ~4:30 PM", the Today screen's summary line.
    var summaryLine: String {
        "\(countLine) · \(TimeMath.formatMinutes(remainingMinutes)) · \(doneByLine)"
    }

    var countLine: String { "\(tasks.count) task\(tasks.count == 1 ? "" : "s")" }
    var doneByLine: String { "done by ~\(TimeMath.formatClock(projectedEnd))" }

    /// Tasks after the one on the clock (all of them when nothing runs).
    var upNext: [TodayWidgetTask] {
        guard let clock else { return tasks }
        return tasks.filter { $0.id != clock.task.id }
    }
}

struct TodayWidgetEntry: TimelineEntry, Hashable, Sendable {
    enum Content: Hashable, Sendable {
        /// No API key in the shared Keychain.
        case signedOut
        /// Signed in, but the app hasn't cached a snapshot yet.
        case notLoaded
        case empty(completedToday: Int)
        case tasks(TodayWidgetTasks)
    }

    var date: Date
    var content: Content

    /// What the widget gallery shows before real data arrives.
    static func placeholder(now: Date = Date()) -> TodayWidgetEntry {
        let tasks = [
            TodayWidgetTask(id: UUID(), title: "Reply to Sam about the deck", estimateMinutes: 15),
            TodayWidgetTask(id: UUID(), title: "Plan next week", estimateMinutes: 30),
            TodayWidgetTask(id: UUID(), title: "Water the plants", estimateMinutes: 10),
        ]
        return TodayWidgetEntry(date: now, content: .tasks(TodayWidgetTasks(
            tasks: tasks, remainingMinutes: 55, projectedEnd: now.addingTimeInterval(55 * 60), clock: nil
        )))
    }
}
