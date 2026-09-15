import Foundation

public struct WeeklyReview: Codable, Identifiable, Hashable, Sendable {
    /// The week's Monday as `yyyy-MM-dd`.
    public var id: String
    public var userId: String
    public var reflection: String
    public var createdAt: Date
    public var updatedAt: Date

    public init(id: String, userId: String = "", reflection: String = "", createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.userId = userId
        self.reflection = reflection
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
