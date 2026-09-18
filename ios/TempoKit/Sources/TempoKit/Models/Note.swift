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
    /// Hashtag projects attached via the `note_projects` join table. Always present on
    /// server responses (defaults to `[]`); optional here only so a client-built value
    /// that hasn't round-tripped through the server can omit it.
    public var projects: [String]?
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: UUID = UUID(), userId: String = "", firestoreId: String? = nil, title: String,
        content: String = "", project: String? = nil, linkedTodoId: UUID? = nil,
        inlineTodoMap: [String: String]? = nil, projects: [String]? = nil,
        createdAt: Date = Date(), updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.firestoreId = firestoreId
        self.title = title
        self.content = content
        self.project = project
        self.linkedTodoId = linkedTodoId
        self.inlineTodoMap = inlineTodoMap
        self.projects = projects
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct NoteDraft: Codable, Hashable, Sendable {
    public var title: String
    public var content: String?
    public var linkedTodoId: UUID?
    public var projects: [String]?

    public init(title: String, content: String? = nil, linkedTodoId: UUID? = nil, projects: [String]? = nil) {
        self.title = title
        self.content = content
        self.linkedTodoId = linkedTodoId
        self.projects = projects
    }
}

public struct NotePatch: Codable, Hashable, Sendable {
    public var title: Patch<String>?
    public var content: Patch<String>?
    public var linkedTodoId: Patch<UUID>?
    public var inlineTodoMap: Patch<[String: String]>?
    /// Not wrapped in `Patch`: sending this key at all (even `[]`) replaces the note's
    /// projects, matching the server's `Array.isArray(projectNames)` check. Omit it to
    /// leave projects untouched.
    public var projects: [String]?

    public init(
        title: Patch<String>? = nil, content: Patch<String>? = nil, linkedTodoId: Patch<UUID>? = nil,
        inlineTodoMap: Patch<[String: String]>? = nil, projects: [String]? = nil
    ) {
        self.title = title
        self.content = content
        self.linkedTodoId = linkedTodoId
        self.inlineTodoMap = inlineTodoMap
        self.projects = projects
    }

    enum CodingKeys: String, CodingKey { case title, content, linkedTodoId, inlineTodoMap, projects }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodePatch(title, forKey: .title)
        try c.encodePatch(content, forKey: .content)
        try c.encodePatch(linkedTodoId, forKey: .linkedTodoId)
        try c.encodePatch(inlineTodoMap, forKey: .inlineTodoMap)
        try c.encodeIfPresent(projects, forKey: .projects)
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decodePatch(forKey: .title)
        content = try c.decodePatch(forKey: .content)
        linkedTodoId = try c.decodePatch(forKey: .linkedTodoId)
        inlineTodoMap = try c.decodePatch(forKey: .inlineTodoMap)
        projects = try c.decodeIfPresent([String].self, forKey: .projects)
    }
}
