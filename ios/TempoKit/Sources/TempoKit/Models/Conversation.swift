import Foundation

public struct Conversation: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var userId: String
    public var firestoreId: String?
    public var mode: String
    public var todoId: UUID?
    public var style: String?
    public var title: String
    /// Raw transcript as shown to the user.
    public var displayMessages: JSONValue
    /// Raw transcript as sent to the model.
    public var apiMessages: JSONValue
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: UUID = UUID(), userId: String = "", firestoreId: String? = nil, mode: String, todoId: UUID? = nil,
        style: String? = nil, title: String, displayMessages: JSONValue = .array([]),
        apiMessages: JSONValue = .array([]), createdAt: Date = Date(), updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.firestoreId = firestoreId
        self.mode = mode
        self.todoId = todoId
        self.style = style
        self.title = title
        self.displayMessages = displayMessages
        self.apiMessages = apiMessages
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
