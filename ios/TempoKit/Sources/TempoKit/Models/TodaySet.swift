import Foundation

/// The day's planned todo ids. `date` is a bare `yyyy-MM-dd` string (a Postgres `date`).
public struct TodaySet: Codable, Identifiable, Hashable, Sendable {
    public var userId: String?
    public var date: String
    public var todoIds: [UUID]
    /// False when the server has no row for the day yet — generate one. Nil on
    /// responses that predate the flag; treat nil as true.
    public var exists: Bool?

    public var id: String { date }

    /// Whether a set has been written for the day (as opposed to merely being empty).
    public var isGenerated: Bool { exists ?? true }

    public init(userId: String? = nil, date: String, todoIds: [UUID] = [], exists: Bool? = nil) {
        self.userId = userId
        self.date = date
        self.todoIds = todoIds
        self.exists = exists
    }
}
