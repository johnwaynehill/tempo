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

/// Body for `POST /api/mood`, built on the phone so a check-in can wait in the write queue:
/// `id` makes a retry idempotent, `createdAt` keeps when it was logged, and `date` (local
/// `yyyy-MM-dd`) is the day the server checks off habits with "mood" in their name.
public struct MoodDraft: Codable, Hashable, Sendable {
    public var id: UUID
    /// 1–100.
    public var value: Int
    public var note: String?
    public var createdAt: Date
    public var date: String

    public init(id: UUID = UUID(), value: Int, note: String? = nil, createdAt: Date, date: String) {
        self.id = id
        self.value = value
        self.note = note
        self.createdAt = createdAt
        self.date = date
    }
}

extension MoodEntry {
    /// The entry as the server will store it, for showing a queued check-in right away.
    public init(draft: MoodDraft, userId: String = "") {
        self.init(id: draft.id, userId: userId, value: draft.value, note: draft.note, createdAt: draft.createdAt)
    }
}
