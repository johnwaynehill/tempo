import Foundation

/// One row of `todos`. Mirrors `api/src/db/schema.ts`.
public struct Todo: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var userId: String
    public var firestoreId: String?
    public var title: String
    public var description: String?
    public var status: TodoStatus
    public var progress: Int?
    public var project: String?
    public var size: TodoSize?
    /// 1–5.
    public var impact: Int?
    public var energyLevel: EnergyLevel?
    public var dueDate: Date?
    public var supports: String?
    public var noteId: UUID?
    public var deferUntil: Date?
    public var reminderAt: Date?
    public var dismissedFromToday: Date?
    public var estimatedMinutes: Int?
    /// First timer start.
    public var startedAt: Date?
    /// Total timed minutes across runs.
    public var actualMinutes: Int?
    public var recurrence: RecurrenceRule?
    public var recurrenceParentId: UUID?
    public var createdAt: Date
    public var updatedAt: Date
    public var completedAt: Date?

    public init(
        id: UUID = UUID(),
        userId: String = "",
        firestoreId: String? = nil,
        title: String,
        description: String? = nil,
        status: TodoStatus = .inbox,
        progress: Int? = nil,
        project: String? = nil,
        size: TodoSize? = nil,
        impact: Int? = nil,
        energyLevel: EnergyLevel? = nil,
        dueDate: Date? = nil,
        supports: String? = nil,
        noteId: UUID? = nil,
        deferUntil: Date? = nil,
        reminderAt: Date? = nil,
        dismissedFromToday: Date? = nil,
        estimatedMinutes: Int? = nil,
        startedAt: Date? = nil,
        actualMinutes: Int? = nil,
        recurrence: RecurrenceRule? = nil,
        recurrenceParentId: UUID? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        completedAt: Date? = nil
    ) {
        self.id = id
        self.userId = userId
        self.firestoreId = firestoreId
        self.title = title
        self.description = description
        self.status = status
        self.progress = progress
        self.project = project
        self.size = size
        self.impact = impact
        self.energyLevel = energyLevel
        self.dueDate = dueDate
        self.supports = supports
        self.noteId = noteId
        self.deferUntil = deferUntil
        self.reminderAt = reminderAt
        self.dismissedFromToday = dismissedFromToday
        self.estimatedMinutes = estimatedMinutes
        self.startedAt = startedAt
        self.actualMinutes = actualMinutes
        self.recurrence = recurrence
        self.recurrenceParentId = recurrenceParentId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.completedAt = completedAt
    }
}

extension Todo: Estimable, Calibratable {}

/// Body for `POST /api/todos`. Only non-nil fields are sent; the client may supply `id`.
public struct TodoDraft: Codable, Hashable, Sendable {
    public var id: UUID?
    public var title: String
    public var description: String?
    public var status: TodoStatus?
    public var progress: Int?
    public var project: String?
    public var size: TodoSize?
    public var impact: Int?
    public var energyLevel: EnergyLevel?
    public var dueDate: Date?
    public var supports: String?
    public var noteId: UUID?
    public var deferUntil: Date?
    public var reminderAt: Date?
    public var estimatedMinutes: Int?
    public var recurrence: RecurrenceRule?
    public var recurrenceParentId: UUID?

    public init(
        id: UUID? = nil,
        title: String,
        description: String? = nil,
        status: TodoStatus? = nil,
        progress: Int? = nil,
        project: String? = nil,
        size: TodoSize? = nil,
        impact: Int? = nil,
        energyLevel: EnergyLevel? = nil,
        dueDate: Date? = nil,
        supports: String? = nil,
        noteId: UUID? = nil,
        deferUntil: Date? = nil,
        reminderAt: Date? = nil,
        estimatedMinutes: Int? = nil,
        recurrence: RecurrenceRule? = nil,
        recurrenceParentId: UUID? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.status = status
        self.progress = progress
        self.project = project
        self.size = size
        self.impact = impact
        self.energyLevel = energyLevel
        self.dueDate = dueDate
        self.supports = supports
        self.noteId = noteId
        self.deferUntil = deferUntil
        self.reminderAt = reminderAt
        self.estimatedMinutes = estimatedMinutes
        self.recurrence = recurrence
        self.recurrenceParentId = recurrenceParentId
    }
}

/// Body for `PUT /api/todos/:id`. Each field is a three-state `Patch`:
/// `nil` leaves the column alone, `.set(x)` writes `x`, `.null` clears it.
/// Only touched fields are encoded.
public struct TodoPatch: Encodable, Hashable, Sendable {
    public var title: Patch<String>?
    public var description: Patch<String>?
    public var status: Patch<TodoStatus>?
    public var progress: Patch<Int>?
    public var project: Patch<String>?
    public var size: Patch<TodoSize>?
    public var impact: Patch<Int>?
    public var energyLevel: Patch<EnergyLevel>?
    public var dueDate: Patch<Date>?
    public var supports: Patch<String>?
    public var noteId: Patch<UUID>?
    public var deferUntil: Patch<Date>?
    public var reminderAt: Patch<Date>?
    public var dismissedFromToday: Patch<Date>?
    public var estimatedMinutes: Patch<Int>?
    public var startedAt: Patch<Date>?
    public var actualMinutes: Patch<Int>?
    public var recurrence: Patch<RecurrenceRule>?
    public var recurrenceParentId: Patch<UUID>?
    public var completedAt: Patch<Date>?

    public init(
        title: Patch<String>? = nil,
        description: Patch<String>? = nil,
        status: Patch<TodoStatus>? = nil,
        progress: Patch<Int>? = nil,
        project: Patch<String>? = nil,
        size: Patch<TodoSize>? = nil,
        impact: Patch<Int>? = nil,
        energyLevel: Patch<EnergyLevel>? = nil,
        dueDate: Patch<Date>? = nil,
        supports: Patch<String>? = nil,
        noteId: Patch<UUID>? = nil,
        deferUntil: Patch<Date>? = nil,
        reminderAt: Patch<Date>? = nil,
        dismissedFromToday: Patch<Date>? = nil,
        estimatedMinutes: Patch<Int>? = nil,
        startedAt: Patch<Date>? = nil,
        actualMinutes: Patch<Int>? = nil,
        recurrence: Patch<RecurrenceRule>? = nil,
        recurrenceParentId: Patch<UUID>? = nil,
        completedAt: Patch<Date>? = nil
    ) {
        self.title = title
        self.description = description
        self.status = status
        self.progress = progress
        self.project = project
        self.size = size
        self.impact = impact
        self.energyLevel = energyLevel
        self.dueDate = dueDate
        self.supports = supports
        self.noteId = noteId
        self.deferUntil = deferUntil
        self.reminderAt = reminderAt
        self.dismissedFromToday = dismissedFromToday
        self.estimatedMinutes = estimatedMinutes
        self.startedAt = startedAt
        self.actualMinutes = actualMinutes
        self.recurrence = recurrence
        self.recurrenceParentId = recurrenceParentId
        self.completedAt = completedAt
    }

    private enum CodingKeys: String, CodingKey {
        case title, description, status, progress, project, size, impact, energyLevel, dueDate,
             supports, noteId, deferUntil, reminderAt, dismissedFromToday, estimatedMinutes,
             startedAt, actualMinutes, recurrence, recurrenceParentId, completedAt
    }

    public var isEmpty: Bool {
        title == nil && description == nil && status == nil && progress == nil && project == nil
            && size == nil && impact == nil && energyLevel == nil && dueDate == nil && supports == nil
            && noteId == nil && deferUntil == nil && reminderAt == nil && dismissedFromToday == nil
            && estimatedMinutes == nil && startedAt == nil && actualMinutes == nil && recurrence == nil
            && recurrenceParentId == nil && completedAt == nil
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodePatch(title, forKey: .title)
        try c.encodePatch(description, forKey: .description)
        try c.encodePatch(status, forKey: .status)
        try c.encodePatch(progress, forKey: .progress)
        try c.encodePatch(project, forKey: .project)
        try c.encodePatch(size, forKey: .size)
        try c.encodePatch(impact, forKey: .impact)
        try c.encodePatch(energyLevel, forKey: .energyLevel)
        try c.encodePatch(dueDate, forKey: .dueDate)
        try c.encodePatch(supports, forKey: .supports)
        try c.encodePatch(noteId, forKey: .noteId)
        try c.encodePatch(deferUntil, forKey: .deferUntil)
        try c.encodePatch(reminderAt, forKey: .reminderAt)
        try c.encodePatch(dismissedFromToday, forKey: .dismissedFromToday)
        try c.encodePatch(estimatedMinutes, forKey: .estimatedMinutes)
        try c.encodePatch(startedAt, forKey: .startedAt)
        try c.encodePatch(actualMinutes, forKey: .actualMinutes)
        try c.encodePatch(recurrence, forKey: .recurrence)
        try c.encodePatch(recurrenceParentId, forKey: .recurrenceParentId)
        try c.encodePatch(completedAt, forKey: .completedAt)
    }
}

/// What `POST /api/todos/:id/complete` returns.
public struct CompletionResult: Codable, Hashable, Sendable {
    public var todo: Todo
    /// The next occurrence for a recurring todo, created by the server; nil otherwise.
    public var nextOccurrence: Todo?

    public init(todo: Todo, nextOccurrence: Todo? = nil) {
        self.todo = todo
        self.nextOccurrence = nextOccurrence
    }
}
