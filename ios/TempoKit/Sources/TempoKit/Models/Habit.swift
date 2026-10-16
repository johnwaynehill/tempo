import Foundation

public struct Habit: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var userId: String
    public var firestoreId: String?
    public var name: String
    public var description: String?
    /// Currently always `"daily"`.
    public var frequency: String
    public var archived: Bool
    /// `"yyyy-MM-dd"` → true for each completed day.
    public var completions: [String: Bool]
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: UUID = UUID(), userId: String = "", firestoreId: String? = nil, name: String,
        description: String? = nil, frequency: String = "daily", archived: Bool = false,
        completions: [String: Bool] = [:], createdAt: Date = Date(), updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.firestoreId = firestoreId
        self.name = name
        self.description = description
        self.frequency = frequency
        self.archived = archived
        self.completions = completions
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public func isCompleted(on dateKey: String) -> Bool {
        completions[dateKey] == true
    }
}

/// A new habit, with a client-generated id so a queued create can be retried safely (the server
/// treats a repeat of the same id as the same habit).
public struct HabitDraft: Codable, Hashable, Sendable {
    public var id: UUID
    public var name: String
    public var description: String?
    public var frequency: String
    public var archived: Bool
    public var completions: [String: Bool]

    public init(id: UUID = UUID(), name: String, description: String? = nil) {
        self.id = id
        self.name = name
        self.description = description
        self.frequency = "daily"
        self.archived = false
        self.completions = [:]
    }
}

/// A partial habit update: `nil` leaves a field alone; `description: .null` clears it.
public struct HabitUpdate: Codable, Hashable, Sendable {
    public var name: String?
    public var description: Patch<String>?
    public var archived: Bool?

    public init(name: String? = nil, description: Patch<String>? = nil, archived: Bool? = nil) {
        self.name = name
        self.description = description
        self.archived = archived
    }

    enum CodingKeys: String, CodingKey { case name, description, archived }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodePatch(description, forKey: .description)
        try c.encodeIfPresent(archived, forKey: .archived)
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        description = try c.decodePatch(forKey: .description)
        archived = try c.decodeIfPresent(Bool.self, forKey: .archived)
    }
}
