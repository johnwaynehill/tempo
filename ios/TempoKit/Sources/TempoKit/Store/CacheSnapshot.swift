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
