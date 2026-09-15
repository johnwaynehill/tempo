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
