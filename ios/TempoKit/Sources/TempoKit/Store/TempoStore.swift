import Foundation

/// Local cache plus write queue in front of `TempoClient`.
///
/// The app reads only from `snapshot` and writes only through `enqueue`, so every
/// screen works the same with or without a network: a write lands in the snapshot
/// immediately, sits in `queue.json` until `flush()` gets it to the server, and is
/// re-applied on top of every `refresh()` until then. The actor owns all mutable
/// state; both files are rewritten atomically after each change.
///
/// Typical use: `load()` at launch and show the cached snapshot, `refresh()` when the
/// app comes to the foreground, `flush()` right after each `enqueue` and on foreground.
public actor TempoStore {
    public struct FlushResult: Sendable {
        /// Ops the server accepted.
        public var sent: Int
        /// Ops the server rejected (4xx) and that were discarded.
        public var dropped: Int
        /// Ops still queued, because the flush stopped early.
        public var remaining: Int
        /// Why the flush stopped early (transport or server failure), nil when it ran through.
        public var error: (any Error)?

        public init(sent: Int = 0, dropped: Int = 0, remaining: Int = 0, error: (any Error)? = nil) {
            self.sent = sent
            self.dropped = dropped
            self.remaining = remaining
            self.error = error
        }
    }

    private let client: TempoClient
    private let directory: URL
    private let calendar: Calendar
    private var cache: CacheSnapshot = .empty
    private var queue: [WriteOp] = []
    private var loaded = false

    private var cacheURL: URL { directory.appendingPathComponent("cache.json") }
    private var queueURL: URL { directory.appendingPathComponent("queue.json") }

    /// - Parameters:
    ///   - directory: Where `cache.json` and `queue.json` live; created on first write.
    ///     Use a per-account folder under Application Support so `signOut` can't wipe
    ///     anything else.
    ///   - calendar: Decides which `yyyy-MM-dd` is "today" for `refreshToday`.
    public init(client: TempoClient, directory: URL, calendar: Calendar = .current) {
        self.client = client
        self.directory = directory
        self.calendar = calendar
    }

    // MARK: Reading

    /// Reads both files from disk. `.empty` (and an empty queue) when there is nothing
    /// or the files don't parse — a corrupt cache is just a cold start.
    @discardableResult
    public func load() -> CacheSnapshot {
        cache = read(CacheSnapshot.self, from: cacheURL) ?? .empty
        queue = read([WriteOp].self, from: queueURL) ?? []
        loaded = true
        return cache
    }

    public var snapshot: CacheSnapshot {
        loadIfNeeded()
        return cache
    }

    public var pendingCount: Int {
        loadIfNeeded()
        return queue.count
    }

    public var pendingOps: [WriteOp] {
        loadIfNeeded()
        return queue
    }

    // MARK: Refreshing

    /// Full pull of todos, events, habits, projects, and preferences in parallel, with
    /// the queue re-applied on top so optimistic writes don't flicker away. Existing
    /// today sets are kept; use `refresh(todayDate:)` to pull one.
    public func refresh() async throws -> CacheSnapshot {
        try await refresh(todayDate: nil)
    }

    /// `refresh()` plus the set for `todayDate` (`yyyy-MM-dd`). When the server has no
    /// set for the day yet it is asked to generate one, unless a `setTodaySet` for that
    /// day is queued — the queued write will create it and must not be overwritten.
    public func refresh(todayDate: String) async throws -> CacheSnapshot {
        try await refresh(todayDate: .some(todayDate))
    }

    /// `refresh(todayDate:)` for the calendar day containing `now`.
    public func refreshToday(now: Date = Date()) async throws -> CacheSnapshot {
        try await refresh(todayDate: DayMath.isoDateString(now, calendar: calendar))
    }

    private func refresh(todayDate: String?) async throws -> CacheSnapshot {
        loadIfNeeded()
        async let todos = client.todos()
        async let events = client.events()
        async let habits = client.habits()
        async let projects = client.projects()
        async let preferences = client.preferences()

        var fresh = CacheSnapshot(
            todos: try await todos, events: try await events, habits: try await habits,
            projects: try await projects, preferences: try await preferences,
            todaySets: cache.todaySets
        )
        if let todayDate {
            var set = try await client.todaySet(date: todayDate)
            let queuedForDay = queue.contains {
                if case .setTodaySet(_, _, let date, _) = $0 { return date == todayDate }
                return false
            }
            if !set.isGenerated && !queuedForDay {
                set = try await client.generateTodaySet(date: todayDate)
            }
            fresh.todaySets[todayDate] = set
        }
        // Whole seconds: exactly representable, so the in-memory snapshot compares
        // equal to what `load()` reads back after an ISO-8601 round trip.
        fresh.lastRefresh = Date(timeIntervalSince1970: Date().timeIntervalSince1970.rounded(.down))
        cache = fresh
        reapplyQueue()
        persist()
        return cache
    }

    // MARK: Writing

    /// Applies `op` to the snapshot now and queues it for the server. Returns the new
    /// snapshot so a view model can render without a second hop through the actor.
    @discardableResult
    public func enqueue(_ op: WriteOp) -> CacheSnapshot {
        loadIfNeeded()
        apply(op)
        queue.append(op)
        persist()
        return cache
    }

    /// Replays the queue in order. A 4xx means the server will never take that op
    /// (row gone, bad key, invalid body) so it is dropped and the rest continue; any
    /// other failure — usually no network — stops the flush and keeps the rest for
    /// next time. Rows the server returns replace the optimistic ones, and the ops
    /// still queued are re-applied on top so their effect isn't lost.
    public func flush() async -> FlushResult {
        loadIfNeeded()
        var result = FlushResult()
        while let op = queue.first {
            do {
                try await send(op)
                queue.removeFirst()
                result.sent += 1
            } catch let error as TempoAPIError where error.isClientError {
                print("TempoStore: dropping \(op.kind) \(op.id) after \(error)")
                queue.removeFirst()
                result.dropped += 1
            } catch let error as TempoAPIError where error.isDecoding {
                // The server applied the write and answered with something we can't read;
                // resending would not help. Drop it and let the next refresh pick up the row.
                print("TempoStore: sent \(op.kind) \(op.id) but could not decode the response: \(error)")
                queue.removeFirst()
                result.sent += 1
            } catch {
                result.error = error
                break
            }
        }
        result.remaining = queue.count
        reapplyQueue()
        persist()
        return result
    }

    /// Forgets everything on disk and in memory. Queued writes are lost, so the app
    /// should `flush()` first when it can.
    public func signOut() {
        cache = .empty
        queue = []
        loaded = true
        try? FileManager.default.removeItem(at: cacheURL)
        try? FileManager.default.removeItem(at: queueURL)
    }

    // MARK: Applying ops

    private func apply(_ op: WriteOp) {
        let now = op.createdAt
        switch op {
        case .createTodo(_, _, let draft):
            cache.upsert(Todo(draft: draft, userId: cache.preferences?.userId ?? "", createdAt: now))
        case .updateTodo(_, _, let todoId, let patch):
            if let todo = cache.todo(id: todoId) {
                cache.upsert(todo.applying(patch, updatedAt: now))
            }
        case .completeTodo(_, _, let todoId, let actualMinutes):
            if var todo = cache.todo(id: todoId) {
                todo.status = .done
                todo.completedAt = now
                todo.updatedAt = now
                if let actualMinutes { todo.actualMinutes = actualMinutes }
                cache.upsert(todo)
            }
        case .deleteTodo(_, _, let todoId):
            cache.todos.removeAll { $0.id == todoId }
        case .toggleHabit(_, _, let habitId, let date, let completed):
            if let i = cache.habits.firstIndex(where: { $0.id == habitId }) {
                // The server deletes the key rather than writing false.
                cache.habits[i].completions[date] = completed ? true : nil
                cache.habits[i].updatedAt = now
            }
        case .setTodaySet(_, _, let date, let todoIds):
            cache.todaySets[date] = TodaySet(userId: cache.preferences?.userId, date: date, todoIds: todoIds, exists: true)
        case .updatePreferences(_, _, let update):
            cache.preferences = (cache.preferences ?? UserPreferences()).applying(update)
        }
    }

    /// Every op is idempotent on the snapshot, so replaying the queue over fresh server
    /// rows (or over rows already carrying the op's effect) is safe.
    private func reapplyQueue() {
        for op in queue { apply(op) }
    }

    // MARK: Sending

    private func send(_ op: WriteOp) async throws {
        switch op {
        case .createTodo(_, _, let draft):
            cache.upsert(try await client.createTodo(draft))
        case .updateTodo(_, _, let todoId, let patch):
            cache.upsert(try await client.updateTodo(id: todoId, patch))
        case .completeTodo(_, _, let todoId, let actualMinutes):
            let result = try await client.completeTodo(id: todoId, actualMinutes: actualMinutes)
            cache.upsert(result.todo)
            if let next = result.nextOccurrence { cache.upsert(next) }
        case .deleteTodo(_, _, let todoId):
            try await client.deleteTodo(id: todoId)
            // Earlier ops in this flush may have merged a server row for it back in.
            cache.todos.removeAll { $0.id == todoId }
        case .toggleHabit(_, _, let habitId, let date, let completed):
            cache.upsert(try await client.toggleHabit(id: habitId, date: date, completed: completed))
        case .setTodaySet(_, _, let date, let todoIds):
            cache.todaySets[date] = try await client.updateTodaySet(date: date, todoIds: todoIds)
        case .updatePreferences(_, _, let update):
            cache.preferences = try await client.updatePreferences(update)
        }
    }

    // MARK: Disk

    private func loadIfNeeded() {
        if !loaded { load() }
    }

    private func read<T: Decodable>(_ type: T.Type, from url: URL) -> T? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? TempoJSON.decoder.decode(type, from: data)
    }

    /// Best effort: a failed write leaves the in-memory state authoritative and the
    /// previous file intact (`.atomic` writes a temp file and renames it into place).
    private func persist() {
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try TempoJSON.encoder.encode(cache).write(to: cacheURL, options: .atomic)
            try TempoJSON.encoder.encode(queue).write(to: queueURL, options: .atomic)
        } catch {
            print("TempoStore: could not persist to \(directory.path): \(error)")
        }
    }
}

extension TempoAPIError {
    /// The server understood the request and said no; retrying can't change that.
    var isClientError: Bool {
        switch self {
        case .unauthorized: true
        case .http(let status, _): (400..<500).contains(status)
        default: false
        }
    }

    var isDecoding: Bool {
        if case .decoding = self { return true }
        return false
    }
}

extension WriteOp {
    /// Case name for log lines.
    var kind: String {
        switch self {
        case .createTodo: "createTodo"
        case .updateTodo: "updateTodo"
        case .completeTodo: "completeTodo"
        case .deleteTodo: "deleteTodo"
        case .toggleHabit: "toggleHabit"
        case .setTodaySet: "setTodaySet"
        case .updatePreferences: "updatePreferences"
        }
    }
}
