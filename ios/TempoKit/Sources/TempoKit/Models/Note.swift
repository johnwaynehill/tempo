import Foundation

public struct Note: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var userId: String
    public var firestoreId: String?
    public var title: String
    public var content: String
    public var project: String?
    public var linkedTodoId: UUID?
    /// checkboxId → todoId, for inline `- [ ]` checkboxes that became todos.
    public var inlineTodoMap: [String: String]?
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: UUID = UUID(), userId: String = "", firestoreId: String? = nil, title: String,
        content: String = "", project: String? = nil, linkedTodoId: UUID? = nil,
        inlineTodoMap: [String: String]? = nil, createdAt: Date = Date(), updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.firestoreId = firestoreId
        self.title = title
        self.content = content
        self.project = project
        self.linkedTodoId = linkedTodoId
        self.inlineTodoMap = inlineTodoMap
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
