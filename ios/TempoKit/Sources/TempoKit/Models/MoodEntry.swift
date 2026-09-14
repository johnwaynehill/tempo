import Foundation

public struct MoodEntry: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var userId: String
    /// 1–100.
    public var value: Int
    public var note: String?
    public var createdAt: Date

    public init(id: UUID = UUID(), userId: String = "", value: Int, note: String? = nil, createdAt: Date = Date()) {
        self.id = id
        self.userId = userId
        self.value = value
        self.note = note
        self.createdAt = createdAt
    }
}
