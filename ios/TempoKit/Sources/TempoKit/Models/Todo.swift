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

/// Body for `POST /api/todos`. Only non-nil fields are sent. `id` is generated on the
/// client (the API accepts it) so an offline create can be shown, referenced, and
/// retried before the server ever hears about it.
public struct TodoDraft: Codable, Hashable, Sendable {
    public var id: UUID
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
        id: UUID = UUID(),
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
/// Only touched fields are encoded, and decoding preserves the three states (a missing
/// key stays `nil`, JSON `null` becomes `.null`) so a queued patch survives a round
/// trip through disk unchanged.
public struct TodoPatch: Codable, Hashable, Sendable {
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

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decodePatch(forKey: .title)
        description = try c.decodePatch(forKey: .description)
        status = try c.decodePatch(forKey: .status)
        progress = try c.decodePatch(forKey: .progress)
        project = try c.decodePatch(forKey: .project)
        size = try c.decodePatch(forKey: .size)
        impact = try c.decodePatch(forKey: .impact)
        energyLevel = try c.decodePatch(forKey: .energyLevel)
        dueDate = try c.decodePatch(forKey: .dueDate)
        supports = try c.decodePatch(forKey: .supports)
        noteId = try c.decodePatch(forKey: .noteId)
        deferUntil = try c.decodePatch(forKey: .deferUntil)
        reminderAt = try c.decodePatch(forKey: .reminderAt)
        dismissedFromToday = try c.decodePatch(forKey: .dismissedFromToday)
        estimatedMinutes = try c.decodePatch(forKey: .estimatedMinutes)
        startedAt = try c.decodePatch(forKey: .startedAt)
        actualMinutes = try c.decodePatch(forKey: .actualMinutes)
        recurrence = try c.decodePatch(forKey: .recurrence)
        recurrenceParentId = try c.decodePatch(forKey: .recurrenceParentId)
        completedAt = try c.decodePatch(forKey: .completedAt)
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

extension Todo {
    /// The todo after `patch`, the way the server would apply it: `.set` writes,
    /// `.null` clears a nullable column, and `.null` on a required column (`title`,
    /// `status`) is ignored rather than corrupting the row. Used for optimistic updates.
    public func applying(_ patch: TodoPatch, updatedAt now: Date) -> Todo {
        var t = self
        if let v = patch.title?.value { t.title = v }
        if let v = patch.status?.value { t.status = v }
        Todo.apply(patch.description, to: &t.description)
        Todo.apply(patch.progress, to: &t.progress)
        Todo.apply(patch.project, to: &t.project)
        Todo.apply(patch.size, to: &t.size)
        Todo.apply(patch.impact, to: &t.impact)
        Todo.apply(patch.energyLevel, to: &t.energyLevel)
        Todo.apply(patch.dueDate, to: &t.dueDate)
        Todo.apply(patch.supports, to: &t.supports)
        Todo.apply(patch.noteId, to: &t.noteId)
        Todo.apply(patch.deferUntil, to: &t.deferUntil)
        Todo.apply(patch.reminderAt, to: &t.reminderAt)
        Todo.apply(patch.dismissedFromToday, to: &t.dismissedFromToday)
        Todo.apply(patch.estimatedMinutes, to: &t.estimatedMinutes)
        Todo.apply(patch.startedAt, to: &t.startedAt)
        Todo.apply(patch.actualMinutes, to: &t.actualMinutes)
        Todo.apply(patch.recurrence, to: &t.recurrence)
        Todo.apply(patch.recurrenceParentId, to: &t.recurrenceParentId)
        Todo.apply(patch.completedAt, to: &t.completedAt)
        t.updatedAt = now
        return t
    }

    /// A row built from a create body, with the defaults the server would fill in.
    public init(draft: TodoDraft, userId: String, createdAt now: Date) {
        self.init(
            id: draft.id, userId: userId, title: draft.title, description: draft.description,
            status: draft.status ?? .inbox, progress: draft.progress, project: draft.project,
            size: draft.size, impact: draft.impact, energyLevel: draft.energyLevel, dueDate: draft.dueDate,
            supports: draft.supports, noteId: draft.noteId, deferUntil: draft.deferUntil,
            reminderAt: draft.reminderAt, estimatedMinutes: draft.estimatedMinutes,
            recurrence: draft.recurrence, recurrenceParentId: draft.recurrenceParentId,
            createdAt: now, updatedAt: now
        )
    }

    private static func apply<V>(_ patch: Patch<V>?, to field: inout V?) {
        guard let patch else { return }
        switch patch {
        case .set(let v): field = v
        case .null: field = nil
        }
    }
}
