import Foundation

/// Everything the app shows, as last seen from the server with any still-queued
/// writes applied on top. Persisted whole as `cache.json`; small enough (a few
/// hundred rows) that rewriting the file on every change is cheaper than a database.
public struct CacheSnapshot: Codable, Hashable, Sendable {
    public var todos: [Todo]
    public var events: [CalendarEvent]
    public var habits: [Habit]
    public var projects: [Project]
    public var preferences: UserPreferences?
    /// Keyed by `yyyy-MM-dd`, the same string the API uses.
    public var todaySets: [String: TodaySet]
    /// When the last successful full pull finished; nil until the first one.
    public var lastRefresh: Date?

    public init(
        todos: [Todo] = [], events: [CalendarEvent] = [], habits: [Habit] = [], projects: [Project] = [],
        preferences: UserPreferences? = nil, todaySets: [String: TodaySet] = [:], lastRefresh: Date? = nil
    ) {
        self.todos = todos
        self.events = events
        self.habits = habits
        self.projects = projects
        self.preferences = preferences
        self.todaySets = todaySets
        self.lastRefresh = lastRefresh
    }

    public static let empty = CacheSnapshot()

    public func todo(id: UUID) -> Todo? {
        todos.first { $0.id == id }
    }

    /// Replaces the row with the same id, or appends. Server rows and optimistic rows
    /// both go through here so the list never holds two copies of one todo.
    public mutating func upsert(_ todo: Todo) {
        if let i = todos.firstIndex(where: { $0.id == todo.id }) {
            todos[i] = todo
        } else {
            todos.append(todo)
        }
    }

    public mutating func upsert(_ habit: Habit) {
        if let i = habits.firstIndex(where: { $0.id == habit.id }) {
            habits[i] = habit
        } else {
            habits.append(habit)
        }
    }
}

extension CacheSnapshot {
    /// Applies a write to the snapshot as if the server had accepted it: the optimistic effect
    /// the app shows the moment you act. Idempotent, so replaying a queue over rows that already
    /// carry an op's effect is safe. Also how the widget previews writes still waiting in the
    /// App Group inbox, so a tap there shows even before the app has been opened to import it.
    public mutating func apply(_ op: WriteOp) {
        let now = op.createdAt
        switch op {
        case .createTodo(_, _, let draft):
            upsert(Todo(draft: draft, userId: preferences?.userId ?? "", createdAt: now))
        case .updateTodo(_, _, let todoId, let patch):
            if let todo = todo(id: todoId) {
                upsert(todo.applying(patch, updatedAt: now))
            }
        case .completeTodo(_, _, let todoId, let actualMinutes):
            if var todo = todo(id: todoId) {
                todo.status = .done
                todo.completedAt = now
                todo.updatedAt = now
                if let actualMinutes { todo.actualMinutes = actualMinutes }
                upsert(todo)
            }
        case .deleteTodo(_, _, let todoId):
            todos.removeAll { $0.id == todoId }
        case .toggleHabit(_, _, let habitId, let date, let completed):
            if let i = habits.firstIndex(where: { $0.id == habitId }) {
                // The server deletes the key rather than writing false.
                habits[i].completions[date] = completed ? true : nil
                habits[i].updatedAt = now
            }
        case .setTodaySet(_, _, let date, let todoIds):
            todaySets[date] = TodaySet(userId: preferences?.userId, date: date, todoIds: todoIds, exists: true)
        case .updatePreferences(_, _, let update):
            preferences = (preferences ?? UserPreferences()).applying(update)
        case .createHabit(_, _, let draft):
            if !habits.contains(where: { $0.id == draft.id }) {
                upsert(Habit(
                    id: draft.id, userId: preferences?.userId ?? "", name: draft.name, description: draft.description,
                    frequency: draft.frequency, archived: draft.archived, completions: draft.completions,
                    createdAt: now, updatedAt: now
                ))
            }
        case .updateHabit(_, _, let habitId, let update):
            if let i = habits.firstIndex(where: { $0.id == habitId }) {
                if let name = update.name { habits[i].name = name }
                if let description = update.description { habits[i].description = description.value }
                if let archived = update.archived { habits[i].archived = archived }
                habits[i].updatedAt = now
            }
        case .deleteHabit(_, _, let habitId):
            habits.removeAll { $0.id == habitId }
        case .createProject(_, _, let draft):
            // Names are unique per user; the server hands back the existing project for a repeat.
            if !projects.contains(where: { $0.id == draft.id || $0.name == draft.name }) {
                projects.append(Project(id: draft.id, userId: preferences?.userId ?? "", name: draft.name, createdAt: now, updatedAt: now))
            }
        case .renameProject(_, _, let projectId, let name):
            if let i = projects.firstIndex(where: { $0.id == projectId }) {
                let old = projects[i].name
                projects[i].name = name
                projects[i].updatedAt = now
                for j in todos.indices where todos[j].project == old { todos[j].project = name }
            }
        case .deleteProject(_, _, let projectId):
            if let i = projects.firstIndex(where: { $0.id == projectId }) {
                let old = projects[i].name
                projects.remove(at: i)
                for j in todos.indices where todos[j].project == old { todos[j].project = nil }
            }
        }
    }
}
