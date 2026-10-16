import CryptoKit
import Foundation
import Network
import Observation
import TempoKit
import UIKit
import WidgetKit
import os

/// The session's data, loaded once and mutated in one place.
///
/// Every screen reads from these arrays and every write goes through a method here.
/// Behind the methods sits a `TempoStore`: the cached snapshot renders the moment the
/// app launches, each write lands in the snapshot immediately and joins a queue, and
/// a non-blocking `flush()` drains the queue whenever the network allows. Nothing else
/// talks to the server, so being offline is invisible to the views except for
/// `pendingCount` and `isOffline`.
///
/// The task timer lives here too (`TimerState`, persisted to `UserDefaults`), so the
/// Now card, Focus Mode, and the Live Activity all read one clock.
@Observable @MainActor
final class AppModel {
    private(set) var todos: [Todo] = []
    private(set) var events: [CalendarEvent] = []
    private(set) var habits: [Habit] = []
    private(set) var projects: [Project] = []
    private(set) var preferences: UserPreferences?
    private(set) var todaySet: TodaySet?

    private(set) var isLoading = false
    /// True once there is something to show: a cached snapshot or a fresh pull.
    private(set) var hasLoaded = false
    var error: String?

    /// Writes waiting for the server.
    private(set) var pendingCount = 0
    /// The last flush or refresh could not reach the server.
    private(set) var isOffline = false

    /// The task timer. Elapsed time is derived from its timestamps and `now`.
    private(set) var timer: TimerState = .idle
    /// Republished once a second while the timer runs so views re-render.
    private(set) var now = Date()
    /// Set when the Start focus App Intent asks for Focus Mode; Today presents it and clears this.
    var focusRequested = false
    /// Set when the Add to Tempo widget's `tempo://capture` link opens the app; Inbox focuses
    /// its capture field and clears this. Unlike `focusRequested` this comes from `onOpenURL`
    /// directly (a URL open always happens in-process), never from a standalone intent path.
    var captureRequested = false
    /// Set by screens pushed on another tab (Plan My Day from More) that finish by sending you
    /// to Today; the tab bar switches and clears it.
    var todayRequested = false

    /// The day a refresh last finished for. Until it matches `todayString`, an empty Today
    /// means "not planned yet", not "nothing to do" — after midnight, or on a cold start before
    /// the network answers, the morning set simply isn't in the cache yet.
    private(set) var refreshedDay: String?
    /// The day `todaySet` was last picked for, so a long-open app notices when it has changed.
    private var lastAppliedDay: String?

    /// True while Today's list can't be trusted yet — see `refreshedDay`.
    var isResolvingToday: Bool { todaySet == nil && refreshedDay != todayString }

    let calendar: Calendar
    private let store: TempoStore
    private let reminders: ReminderScheduler
    private let activity: TimerActivityController
    private var loadTask: Task<Void, Never>?
    private var flushTask: Task<Void, Never>?
    private var tickTask: Task<Void, Never>?
    /// Keeps `now` current while the app sits open, and reacts to midnight, clock and time zone
    /// changes. Without it "done by ~4:30 PM" and the overcommit note go stale, and Today keeps
    /// the previous day's set after midnight.
    private var clockTask: Task<Void, Never>?
    private var clockObservers: [NSObjectProtocol] = []
    /// Retries a failed flush when the network returns or after a growing delay.
    private let pathMonitor = NWPathMonitor()
    private var retryTask: Task<Void, Never>?
    private var retryAttempt = 0
    private var wasOnline = true
    /// Live Activity calls run one after another so a start can't race an update.
    private var activityTask: Task<Void, Never>?
    /// The todo the current Live Activity was requested for; nil once ended.
    private var activityTodoId: UUID?

    private static let timerDefaultsKey = AppGroup.timerStateKey
    private static let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "store")

    init(
        client: TempoClient,
        apiKey: String,
        reminders: ReminderScheduler = ReminderScheduler(),
        activity: TimerActivityController = TimerActivityController(),
        calendar: Calendar = .autoupdatingCurrent
    ) {
        self.store = TempoStore(client: client, directory: Self.storeDirectory(for: apiKey), calendar: calendar)
        self.reminders = reminders
        self.activity = activity
        self.calendar = calendar
        restoreTimer()
        consumeFocusRequest()
        startClockWatch()
        startPathWatch()
    }

    isolated deinit {
        clockTask?.cancel()
        retryTask?.cancel()
        pathMonitor.cancel()
        clockObservers.forEach(NotificationCenter.default.removeObserver)
    }

    // MARK: Clock and connectivity

    private func startClockWatch() {
        clockTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                guard !Task.isCancelled, let self else { return }
                self.minuteTick()
            }
        }
        let center = NotificationCenter.default
        let names: [Notification.Name] = [
            .NSCalendarDayChanged, .NSSystemTimeZoneDidChange, UIApplication.significantTimeChangeNotification,
        ]
        clockObservers = names.map { name in
            center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in await self?.dayMayHaveChanged() }
            }
        }
    }

    private func minuteTick() {
        // The timer's own 1 Hz tick already republishes `now` while it runs.
        if !timer.isRunning { now = Date() }
        if let day = lastAppliedDay, day != todayString { Task { await dayMayHaveChanged() } }
    }

    /// Midnight, a time zone change, or the clock being set: re-pick today's set from the cache
    /// (it is nil for a new day until a refresh pulls or generates it) and go get it.
    private func dayMayHaveChanged() async {
        now = Date()
        guard loadTask != nil else { return }
        apply(await store.snapshot)
        await refresh()
    }

    private func startPathWatch() {
        pathMonitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in
                guard let self else { return }
                let regained = online && !self.wasOnline
                self.wasOnline = online
                if regained, self.pendingCount > 0 { self.scheduleFlush() }
            }
        }
        pathMonitor.start(queue: DispatchQueue(label: "com.johnwaynehill.Tempo.path"))
    }

    /// `<App Group>/Tempo/<account folder>` (`AppGroup.accountDirectory`) so the widget can read
    /// the cached snapshot; one folder per account so `signOut()` can't wipe anyone else's cache.
    /// A cache an earlier build left in Application Support is moved over once. A build without
    /// the App Group entitlement keeps using Application Support.
    static func storeDirectory(for apiKey: String) -> URL {
        let legacy = (FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory)
            .appendingPathComponent("Tempo", isDirectory: true)
            .appendingPathComponent(AppGroup.accountFolderName(forAPIKey: apiKey), isDirectory: true)
        guard let shared = AppGroup.accountDirectory(forAPIKey: apiKey) else { return legacy }

        let files = FileManager.default
        if !files.fileExists(atPath: shared.path), files.fileExists(atPath: legacy.path) {
            do {
                try files.createDirectory(at: shared.deletingLastPathComponent(), withIntermediateDirectories: true)
                try files.moveItem(at: legacy, to: shared)
                log.info("store: moved the cache into the App Group")
            } catch {
                log.error("store: couldn't move the cache into the App Group: \(String(describing: error), privacy: .public)")
                return legacy
            }
        }
        return shared
    }

    // MARK: Derived

    var todayString: String {
        TodayResolution.todayDateString(now: Date(), calendar: calendar)
    }

    var inbox: [Todo] { todos.filter { $0.status == .inbox } }
    /// Backlog proper, plus anything deferred whose date has passed — it is a candidate again, as
    /// in the scorer and on the web, so it must be somewhere you can see it.
    var backlog: [Todo] {
        let now = Date()
        return todos.filter { $0.isBacklogCandidate(at: now) }
    }
    /// Deferred to a future date: out of every other list until then.
    var deferredLater: [Todo] {
        let now = Date()
        return todos
            .filter { $0.isDeferred(at: now) }
            .sorted { ($0.deferUntil ?? .distantFuture) < ($1.deferUntil ?? .distantFuture) }
    }

    var pinned: [Todo] { todos.filter { $0.status == .todayPinned } }

    /// Oldest first, like the web. The API returns habits in no particular order, and each toggle
    /// rewrites a row, so without a sort the list can reshuffle under your thumb.
    var activeHabits: [Habit] { habits.filter { !$0.archived }.sorted { $0.createdAt < $1.createdAt } }
    var projectNames: [String] { projects.map(\.name).sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending } }

    func todo(id: UUID) -> Todo? {
        todos.first { $0.id == id }
    }

    /// Today's list: pinned first, then the morning set resolved against live todos.
    var todayTodos: [Todo] {
        TodayResolution.resolveTodayTodos(todaySet: todaySet, todos: todos, pinned: pinned, today: todayString)
    }

    /// Events starting on the same local day as now; all-day first, then by start time.
    var todayEvents: [CalendarEvent] {
        let now = Date()
        return events
            .filter { calendar.isDate($0.startTime, inSameDayAs: now) }
            .sorted { a, b in
                if a.allDay != b.allDay { return a.allDay }
                return a.startTime < b.startTime
            }
    }

    /// Todos completed since local midnight.
    var completedTodayCount: Int {
        let start = DayMath.startOfDay(Date(), calendar: calendar)
        return todos.filter { $0.status == .done && ($0.completedAt ?? .distantPast) >= start }.count
    }

    // MARK: Loading

    /// Shows the cached snapshot right away, then pulls fresh rows. Safe to call from
    /// every tab's `.task`; only the first call does the work.
    func loadIfNeeded() async {
        if let loadTask {
            await loadTask.value
            return
        }
        let task = Task { await initialLoad() }
        loadTask = task
        await task.value
    }

    private func initialLoad() async {
        let cached = await store.load()
        pendingCount = await store.pendingCount
        Self.log.info("load: cached todos=\(cached.todos.count) lastRefresh=\(cached.lastRefresh?.description ?? "nil", privacy: .public) pending=\(self.pendingCount)")
        if cached.lastRefresh != nil {
            apply(cached)
            hasLoaded = true
        }
        await drainInbox()
        await refresh()
        await flush()
        Self.log.info("load: done hasLoaded=\(self.hasLoaded) offline=\(self.isOffline) pending=\(self.pendingCount)")
    }

    /// Pull-to-refresh: drain the queue first so the pull reflects our own writes.
    func reload() async {
        await drainInbox()
        await flush()
        await refresh()
    }

    /// The scene came to the foreground: same two calls as launch, minus the disk read.
    func activate() async {
        // A timer the widget or a Shortcut started while we were away, and a pending Start focus.
        adoptSharedTimer()
        consumeFocusRequest()
        guard loadTask != nil else { return }
        tick()
        await drainInbox()
        await flush()
        await refresh()
    }

    /// Imports writes the share extension and App Intents dropped in the App Group inbox,
    /// so they get the same optimistic apply, queue and flush as writes made in the app.
    private func drainInbox() async {
        guard let url = AppGroup.inboxURL else { return }
        let imported = await PendingOpInbox(directory: url).drain(into: store)
        guard imported > 0 else { return }
        Self.log.info("inbox: imported \(imported) op(s)")
        pendingCount = await store.pendingCount
        apply(await store.snapshot)
        scheduleFlush()
    }

    private func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        let day = todayString
        defer {
            isLoading = false
            refreshedDay = day
        }
        do {
            let snapshot = try await store.refreshToday(now: Date())
            apply(snapshot)
            hasLoaded = true
            isOffline = false
            error = nil
        } catch let apiError as TempoAPIError {
            Self.log.info("refresh failed: \(String(describing: apiError), privacy: .public)")
            if case .transport = apiError {
                isOffline = true
                // With something cached the banner is enough; a cold start needs the message.
                error = hasLoaded ? nil : Self.describe(apiError)
            } else {
                error = Self.describe(apiError)
            }
        } catch {
            self.error = Self.describe(error)
        }
    }

    private func apply(_ snapshot: CacheSnapshot) {
        todos = snapshot.todos
        events = snapshot.events
        habits = snapshot.habits
        projects = snapshot.projects
        preferences = snapshot.preferences
        todaySet = snapshot.todaySets[todayString]
        lastAppliedDay = todayString
        didChange()
        // The store has already written the snapshot to disk; let the widget re-read it.
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: Todo mutations

    @discardableResult
    func createTodo(
        title: String, status: TodoStatus = .inbox, project: String? = nil, energyLevel: EnergyLevel? = nil
    ) async -> Todo? {
        let draft = TodoDraft(id: UUID(), title: title, status: status, project: project, energyLevel: energyLevel)
        await enqueue(.createTodo(draft: draft))
        return todo(id: draft.id)
    }

    @discardableResult
    func update(todo id: UUID, patch: TodoPatch) async -> Todo? {
        guard !patch.isEmpty else { return todo(id: id) }
        await enqueue(.updateTodo(todoId: id, patch: patch))
        return todo(id: id)
    }

    /// Completing the task that's on the clock stops the clock and banks the run's minutes, from
    /// wherever it is completed (a list circle, detail, Focus Mode) — not only from the Now card.
    func complete(id: UUID, actualMinutes: Int? = nil) async {
        if actualMinutes == nil, timer.activeTaskId == id {
            await completeActive()
            return
        }
        await enqueue(.completeTodo(todoId: id, actualMinutes: actualMinutes))
    }

    /// Undo for a completion: back to the Backlog with no completion time. (A recurring todo's next
    /// occurrence, already created by the server, is left alone.)
    func uncomplete(id: UUID) async {
        await update(todo: id, patch: TodoPatch(status: .set(.backlog), completedAt: .null))
    }

    /// A deferred todo, back in the Backlog now.
    func restoreFromDefer(id: UUID) async {
        await update(todo: id, patch: TodoPatch(status: .set(.backlog), deferUntil: .null))
    }

    func delete(id: UUID) async {
        await enqueue(.deleteTodo(todoId: id))
    }

    func pin(id: UUID) async {
        await update(todo: id, patch: TodoPatch(status: .set(.todayPinned)))
    }

    func moveToBacklog(id: UUID) async {
        await update(todo: id, patch: TodoPatch(status: .set(.backlog)))
    }

    func `defer`(id: UUID, until: Date) async {
        await update(todo: id, patch: TodoPatch(status: .set(.deferred), deferUntil: .set(until)))
    }

    /// "Not today": stamps `dismissedFromToday` so the scorer skips it for the rest of
    /// the day and drops it from the day's set. A pinned todo is unpinned too, since
    /// pinned todos sit on Today regardless of the set.
    func dismissFromToday(id: UUID) async {
        let wasPinned = todo(id: id)?.status == .todayPinned
        let patch = TodoPatch(
            status: wasPinned ? .set(.backlog) : nil,
            dismissedFromToday: .set(Date())
        )
        await enqueue(.updateTodo(todoId: id, patch: patch))
        if let set = todaySet, set.todoIds.contains(id) {
            await enqueue(.setTodaySet(date: set.date, todoIds: set.todoIds.filter { $0 != id }))
        }
    }

    /// Replaces today's suggestion set outright (Plan My Day's "Start my day"). Pinned
    /// todos show on Today regardless of this set, so pin any newly-chosen ones first.
    func setTodaySet(todoIds: [UUID]) async {
        await enqueue(.setTodaySet(date: todayString, todoIds: todoIds))
    }

    // MARK: Habits

    func toggleHabit(id: UUID, date: String, completed: Bool) async {
        await enqueue(.toggleHabit(habitId: id, date: date, completed: completed))
    }

    // MARK: Session

    /// Drops the cache, the queue, the timer, and the Live Activity.
    func signOut() async {
        flushTask?.cancel()
        loadTask?.cancel()
        retryTask?.cancel()
        retryAttempt = 0
        setTimer(.idle)
        await store.signOut()
        // This account's reminders must not keep firing, and writes the widget or share sheet
        // dropped in the shared inbox belong to it, not to whoever signs in next.
        reminders.sync(todos: [])
        if let inbox = AppGroup.inboxURL {
            try? FileManager.default.removeItem(at: inbox)
        }
        refreshedDay = nil
        lastAppliedDay = nil
        todos = []
        events = []
        habits = []
        projects = []
        preferences = nil
        todaySet = nil
        pendingCount = 0
        hasLoaded = false
    }

    // MARK: Timer

    var timerSnapshot: TimerSnapshot? { timer.snapshot(at: now) }
    var elapsedSeconds: Int { timer.elapsedSeconds(at: now) }

    /// The todo on the clock, as long as it is still on Today.
    var activeTodo: Todo? {
        guard let id = timer.activeTaskId else { return nil }
        return todayTodos.first { $0.id == id }
    }

    /// Starts a fresh run on `todoId`, stamping `startedAt` the first time.
    func startTimer(_ todoId: UUID) {
        guard let todo = todo(id: todoId) else { return }
        // Switching tasks mid-run: record what the outgoing one has so far instead of discarding it.
        if timer.isActive, timer.activeTaskId != todoId { stopTimer() }
        let start = Date()
        if let patch = TaskTimer.startPatch(for: todo, at: start) {
            Task { await enqueue(.updateTodo(todoId: todoId, patch: patch)) }
        }
        setTimer(timer.starting(todoId, at: start))
    }

    func pauseTimer() {
        setTimer(timer.paused(at: Date()))
    }

    func resumeTimer() {
        setTimer(timer.resumed(at: Date()))
    }

    /// Stops the clock and, by default, adds the run to the todo's `actualMinutes`.
    /// Pass `persist: false` when the caller writes the todo itself (completion).
    @discardableResult
    func stopTimer(persist: Bool = true) -> (minutesThisRun: Int, actualMinutes: Int) {
        let taskId = timer.activeTaskId
        let prior = taskId.flatMap { todo(id: $0)?.actualMinutes }
        let result = TaskTimer.stopResult(state: timer, priorActualMinutes: prior, at: Date())
        setTimer(result.state)
        if persist, let taskId,
           let patch = TaskTimer.stopPatch(minutesThisRun: result.minutesThisRun, actualMinutes: result.actualMinutes) {
            Task { await enqueue(.updateTodo(todoId: taskId, patch: patch)) }
        }
        return (result.minutesThisRun, result.actualMinutes)
    }

    /// Completes the todo on the clock, sending the run's minutes with the completion.
    func completeActive() async {
        guard let id = timer.activeTaskId else { return }
        let (_, actualMinutes) = stopTimer(persist: false)
        await complete(id: id, actualMinutes: actualMinutes > 0 ? actualMinutes : nil)
    }

    private func setTimer(_ next: TimerState) {
        let previous = timer
        guard next != previous else { return }
        timer = next
        now = Date()
        persistTimer()
        updateTick()
        syncActivity(previous: previous)
    }

    private func restoreTimer() {
        activity.adoptExisting()
        guard let data = AppGroup.defaults.data(forKey: Self.timerDefaultsKey) ?? Self.takeLegacyTimerData(),
              let saved = try? TempoJSON.decoder.decode(TimerState.self, from: data)
        else {
            // Cleared by another process while this model still showed a clock.
            if timer.isActive {
                timer = .idle
                updateTick()
            }
            if activity.isActive { endActivity() }
            return
        }
        if saved.isStale(at: Date(), calendar: calendar) {
            AppGroup.defaults.removeObject(forKey: Self.timerDefaultsKey)
            if activity.isActive { endActivity() }
            return
        }
        timer = saved
        updateTick()
        if let existing = activity.activity, existing.attributes.todoId == saved.activeTaskId {
            activityTodoId = existing.attributes.todoId
        } else if activity.isActive {
            endActivity()
        }
    }

    /// Shared defaults, so the widget and App Intents see the same clock.
    private func persistTimer() {
        if timer.isActive, let data = try? TempoJSON.encoder.encode(timer) {
            AppGroup.defaults.set(data, forKey: Self.timerDefaultsKey)
        } else {
            AppGroup.defaults.removeObject(forKey: Self.timerDefaultsKey)
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// A timer saved before the App Group existed; moved out of standard defaults once.
    private static func takeLegacyTimerData() -> Data? {
        guard let data = UserDefaults.standard.data(forKey: timerDefaultsKey) else { return nil }
        UserDefaults.standard.removeObject(forKey: timerDefaultsKey)
        return data
    }

    /// A 1 Hz tick only while running; paused and idle timers have nothing to redraw.
    private func updateTick() {
        if timer.isRunning {
            guard tickTask == nil else { return }
            tickTask = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(1))
                    guard !Task.isCancelled, let self else { return }
                    self.tick()
                }
            }
        } else {
            tickTask?.cancel()
            tickTask = nil
        }
    }

    private func tick() {
        now = Date()
        if timer.isStale(at: now, calendar: calendar) {
            stopTimer(persist: false)
        }
    }

    /// Drops the timer when its todo is no longer on Today (completed elsewhere,
    /// deferred, deleted, unpinned) — the run isn't recorded, as on the web.
    private func reconcileTimer() {
        guard hasLoaded, timer.isActive, activeTodo == nil else { return }
        stopTimer(persist: false)
    }

    // MARK: Live Activity

    private func syncActivity(previous: TimerState) {
        guard let id = timer.activeTaskId, let startedAt = timer.startedAt else {
            if previous.isActive || activityTodoId != nil || activity.isActive { endActivity() }
            return
        }
        let state = TempoTimerAttributes.ContentState(
            startedAt: startedAt,
            accumulatedSeconds: timer.accumulatedSeconds,
            runningSince: timer.runningSince,
            isPaused: timer.isPaused
        )
        if activityTodoId != id {
            // The title comes from the todo; a timer restored before the snapshot
            // arrived starts its activity from `didChange` once the row is in.
            guard let todo = todo(id: id) else { return }
            activityTodoId = id
            let attributes = TempoTimerAttributes(
                todoId: id, todoTitle: todo.title, estimateMinutes: TimeMath.getEstimate(todo)
            )
            chainActivity { [activity] in try? await activity.start(attributes: attributes, state: state) }
        } else {
            chainActivity { [activity] in await activity.update(state: state) }
        }
    }

    private func endActivity() {
        activityTodoId = nil
        chainActivity { [activity] in await activity.end() }
    }

    private func chainActivity(_ work: @escaping @MainActor () async -> Void) {
        let previous = activityTask
        activityTask = Task {
            await previous?.value
            await work()
        }
    }

    // MARK: Plumbing

    /// Applies `op` locally, re-renders from the returned snapshot, and kicks off a
    /// flush without waiting for it. Every write funnels through here.
    private func enqueue(_ op: WriteOp) async {
        let snapshot = await store.enqueue(op)
        pendingCount = await store.pendingCount
        apply(snapshot)
        scheduleFlush()
    }

    private func scheduleFlush() {
        Task { await flush() }
    }

    /// A flush that stopped early leaves its writes queued; without this they'd wait for the
    /// next edit, foreground, or pull. Back off 5 s, 15 s, 45 s … up to 5 min. A rejected key
    /// won't fix itself, so that case waits for a new sign-in instead.
    private func scheduleRetry(after error: any Error) {
        if let apiError = error as? TempoAPIError, case .unauthorized = apiError { return }
        guard pendingCount > 0 else { return }
        retryTask?.cancel()
        let delay = min(300, 5 * pow(3, Double(retryAttempt)))
        retryAttempt += 1
        retryTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled, let self else { return }
            await self.flush()
        }
    }

    /// Flushes run one at a time, each chained after the one before it.
    ///
    /// This used to be `while let running = flushTask { await running.value }`, clearing the
    /// task once the caller that started it resumed. When a second caller arrived after the task
    /// finished but before that first caller got the main actor back, awaiting the finished task
    /// returned without suspending, so the loop spun on the main actor forever and the first
    /// caller never ran to clear it: the app froze at 100% CPU. Chaining never waits on anything
    /// but a strictly earlier task, so it can't spin.
    private func flush() async {
        let previous = flushTask
        let task = Task {
            await previous?.value
            await performFlush()
        }
        flushTask = task
        await task.value
    }

    private func performFlush() async {
        let result = await store.flush()
        pendingCount = await store.pendingCount
        Self.log.info("flush: sent=\(result.sent) dropped=\(result.dropped) remaining=\(result.remaining) error=\(result.error.map { String(describing: $0) } ?? "none", privacy: .public)")
        if let flushError = result.error {
            if let apiError = flushError as? TempoAPIError, case .transport = apiError {
                isOffline = true
            } else {
                error = Self.describe(flushError)
            }
            scheduleRetry(after: flushError)
        } else if result.sent > 0 || result.dropped > 0 {
            retryAttempt = 0
            retryTask?.cancel()
            // Only a flush that actually reached the server says anything about being
            // online; an empty queue draining "successfully" must not clear the flag.
            isOffline = false
            apply(await store.snapshot)
        }
    }

    private func didChange() {
        reminders.sync(todos: todos)
        reconcileTimer()
        // A timer restored before the snapshot arrived can only build its Live Activity now.
        if timer.isActive, activityTodoId != timer.activeTaskId, activeTodo != nil {
            syncActivity(previous: .idle)
        }
    }

    private static func describe(_ error: any Error) -> String {
        guard let apiError = error as? TempoAPIError else {
            return "Something went wrong talking to Tempo."
        }
        return switch apiError {
        case .unauthorized: "Tempo rejected your sign-in. Your changes are kept — sign out and sign in again."
        case .transport: "Couldn't reach Tempo. Pull to try again."
        case .http(let status, _): "Tempo answered with an error (\(status))."
        case .decoding, .invalidResponse: "Tempo sent something unexpected."
        }
    }
}

// MARK: - App Intents

/// Intents running in the app's process go through the model (`TempoIntentBridge.host`), so the
/// Now card, the write queue and the Live Activity stay in step with what the intent did.
extension AppModel: TempoIntentHost {
    /// The summary line's Start, for Start next. Nil before the first load so the intent falls
    /// back to the shared-container path rather than reading an empty list.
    func startNextTask() async -> StartNextOutcome? {
        guard hasLoaded else { return nil }
        if let id = timer.activeTaskId {
            return .alreadyRunning(title: todo(id: id)?.title ?? "your task")
        }
        guard let first = todayTodos.first else { return .nothingToday }
        startTimer(first.id)
        // Let the Live Activity request land while the intent still keeps the process awake.
        await activityTask?.value
        return .started(title: first.title)
    }

    /// The widget's Complete button. Nil before the first load, same reasoning as `startNextTask`.
    func completeActiveTask() async -> CompleteActiveOutcome? {
        guard hasLoaded else { return nil }
        guard let id = timer.activeTaskId else { return .nothingActive }
        let title = todo(id: id)?.title ?? "your task"
        await completeActive()
        return .completed(title: title)
    }

    func addTodo(title: String) async {
        await createTodo(title: title, status: .inbox)
    }

    /// The launch-time restore, re-run: adopts a timer (and its Live Activity) another process
    /// saved to the App Group, then builds the activity if the restore couldn't.
    func adoptSharedTimer() {
        restoreTimer()
        now = Date()
        if timer.isActive, activityTodoId != timer.activeTaskId, activeTodo != nil {
            syncActivity(previous: .idle)
        }
    }

    func consumeFocusRequest() {
        if TempoIntentBridge.takeFocusRequest() {
            focusRequested = true
        }
    }
}
