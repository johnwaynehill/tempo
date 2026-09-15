import Foundation
import Observation
import TempoKit

/// Shapes what the Today screen shows out of `AppModel`. Holds no data of its own:
/// the todo list, the day's set, the events, and the timer all live on the model, so
/// a mutation made from any tab shows up here without a refetch.
@Observable @MainActor
final class TodayViewModel {
    private let model: AppModel

    init(model: AppModel) {
        self.model = model
    }

    var todayTodos: [Todo] { model.todayTodos }
    var todayEvents: [CalendarEvent] { model.todayEvents }
    var isLoading: Bool { model.isLoading }
    var hasLoaded: Bool { model.hasLoaded }
    var error: String? { model.error }
    var completedTodayCount: Int { model.completedTodayCount }

    /// "Offline. Changes will sync when you're back." — only while something is
    /// actually waiting; a quiet offline read needs no banner.
    var showsOfflineBanner: Bool { model.isOffline && model.pendingCount > 0 }

    // MARK: Timer

    var timer: TimerState { model.timer }
    var elapsedSeconds: Int { model.elapsedSeconds }
    var timerSnapshot: TimerSnapshot? { model.timerSnapshot }

    /// The running task, lifted out of the list into the Now card.
    var activeTodo: Todo? { model.activeTodo }

    /// Everything on Today except the task on the clock.
    var listTodos: [Todo] {
        guard let active = activeTodo else { return todayTodos }
        return todayTodos.filter { $0.id != active.id }
    }

    struct Summary: Equatable {
        var taskCount: Int
        var remainingMinutes: Int
        var projectedEnd: Date

        var line: String {
            let tasks = "\(taskCount) task\(taskCount == 1 ? "" : "s")"
            return "\(tasks) · \(TimeMath.formatMinutes(remainingMinutes)) · done by ~\(TimeMath.formatClock(projectedEnd))"
        }
    }

    /// Recomputed every tick while a timer runs, since `model.now` feeds the snapshot.
    var summary: Summary? {
        let todos = todayTodos
        guard !todos.isEmpty else { return nil }
        let snapshot = timerSnapshot
        return Summary(
            taskCount: todos.count,
            remainingMinutes: TimeMath.remainingMinutes(todos, timer: snapshot),
            projectedEnd: TimeMath.projectedEndTime(todos, timer: snapshot, now: model.now)
        )
    }

    /// The overcommitment sentence under the summary line, when the plan doesn't fit
    /// the working hours left today.
    var overcommitNote: String? {
        Availability.todayOvercommitMessage(
            todos: todayTodos,
            timer: timerSnapshot,
            events: model.events,
            dayStart: model.preferences?.workDayStart ?? Availability.DEFAULT_WORK_DAY_START,
            dayEnd: model.preferences?.workDayEnd ?? Availability.DEFAULT_WORK_DAY_END,
            now: model.now,
            calendar: model.calendar
        )
    }

    // MARK: Actions

    func loadIfNeeded() async {
        await model.loadIfNeeded()
    }

    func reload() async {
        await model.reload()
    }

    func complete(id: UUID) async {
        await model.complete(id: id)
    }

    func notToday(id: UUID) async {
        await model.dismissFromToday(id: id)
    }

    func start(id: UUID) {
        model.startTimer(id)
    }

    /// The summary line's Start: the first task on Today.
    func startFirst() {
        guard let first = todayTodos.first else { return }
        model.startTimer(first.id)
    }

    func pause() { model.pauseTimer() }
    func resume() { model.resumeTimer() }
    func stop() { model.stopTimer() }

    func completeActive() async {
        await model.completeActive()
    }

    func signOut() async {
        await model.signOut()
    }
}
