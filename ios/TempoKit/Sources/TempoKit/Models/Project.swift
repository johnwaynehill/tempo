import Foundation

public struct Project: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var userId: String
    public var name: String
    public var createdAt: Date
    public var updatedAt: Date

    public init(id: UUID = UUID(), userId: String = "", name: String, createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.userId = userId
        self.name = name
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Body for `POST /api/projects`. The id is client-generated so a queued create can be retried
/// and later ops can refer to the project before the server has seen it.
public struct ProjectDraft: Codable, Hashable, Sendable {
    public var id: UUID
    public var name: String

    public init(id: UUID = UUID(), name: String) {
        self.id = id
        self.name = name
    }
}
