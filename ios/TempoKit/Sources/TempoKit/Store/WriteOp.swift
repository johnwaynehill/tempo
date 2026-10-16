import Foundation

/// One queued write, replayed against the API in creation order by `TempoStore.flush()`.
///
/// Every case carries its own `id` (so an op can be found and removed) and `createdAt`
/// (the "now" used when applying it optimistically, so re-applying the queue after a
/// refresh gives the same timestamps as the first application). Each op maps to one
/// idempotent API call: `PUT` shapes and client-generated todo ids mean a retry after a
/// half-failed flush is harmless.
public enum WriteOp: Codable, Hashable, Sendable, Identifiable {
    case createTodo(id: UUID = UUID(), createdAt: Date = Date(), draft: TodoDraft)
    case updateTodo(id: UUID = UUID(), createdAt: Date = Date(), todoId: UUID, patch: TodoPatch)
    case completeTodo(id: UUID = UUID(), createdAt: Date = Date(), todoId: UUID, actualMinutes: Int?)
    case deleteTodo(id: UUID = UUID(), createdAt: Date = Date(), todoId: UUID)
    /// `date` is `yyyy-MM-dd`.
    case toggleHabit(id: UUID = UUID(), createdAt: Date = Date(), habitId: UUID, date: String, completed: Bool)
    /// `date` is `yyyy-MM-dd`.
    case setTodaySet(id: UUID = UUID(), createdAt: Date = Date(), date: String, todoIds: [UUID])
    case updatePreferences(id: UUID = UUID(), createdAt: Date = Date(), update: UserPreferencesUpdate)
    case createHabit(id: UUID = UUID(), createdAt: Date = Date(), draft: HabitDraft)
    case updateHabit(id: UUID = UUID(), createdAt: Date = Date(), habitId: UUID, update: HabitUpdate)
    case deleteHabit(id: UUID = UUID(), createdAt: Date = Date(), habitId: UUID)
    case createProject(id: UUID = UUID(), createdAt: Date = Date(), draft: ProjectDraft)
    /// The server renames every todo carrying the old name too.
    case renameProject(id: UUID = UUID(), createdAt: Date = Date(), projectId: UUID, name: String)
    /// The server clears the project from its todos; the todos stay.
    case deleteProject(id: UUID = UUID(), createdAt: Date = Date(), projectId: UUID)

    /// The op's own id, not the id of the row it touches.
    public var id: UUID {
        switch self {
        case .createTodo(let id, _, _), .updateTodo(let id, _, _, _), .completeTodo(let id, _, _, _),
             .deleteTodo(let id, _, _), .toggleHabit(let id, _, _, _, _), .setTodaySet(let id, _, _, _),
             .updatePreferences(let id, _, _), .createHabit(let id, _, _), .updateHabit(let id, _, _, _),
             .deleteHabit(let id, _, _), .createProject(let id, _, _), .renameProject(let id, _, _, _),
             .deleteProject(let id, _, _):
            id
        }
    }

    public var createdAt: Date {
        switch self {
        case .createTodo(_, let at, _), .updateTodo(_, let at, _, _), .completeTodo(_, let at, _, _),
             .deleteTodo(_, let at, _), .toggleHabit(_, let at, _, _, _), .setTodaySet(_, let at, _, _),
             .updatePreferences(_, let at, _), .createHabit(_, let at, _), .updateHabit(_, let at, _, _),
             .deleteHabit(_, let at, _), .createProject(_, let at, _), .renameProject(_, let at, _, _),
             .deleteProject(_, let at, _):
            at
        }
    }

    /// The row this op writes (todo, habit or project), if it writes a single row.
    public var rowId: UUID? {
        switch self {
        case .createHabit(_, _, let draft): draft.id
        case .toggleHabit(_, _, let habitId, _, _), .updateHabit(_, _, let habitId, _), .deleteHabit(_, _, let habitId): habitId
        case .createProject(_, _, let draft): draft.id
        case .renameProject(_, _, let projectId, _), .deleteProject(_, _, let projectId): projectId
        case .setTodaySet, .updatePreferences: nil
        default: todoId
        }
    }

    /// The todo this op touches, if any (a `createTodo` reports the draft's id).
    public var todoId: UUID? {
        switch self {
        case .createTodo(_, _, let draft): draft.id
        case .updateTodo(_, _, let todoId, _), .completeTodo(_, _, let todoId, _), .deleteTodo(_, _, let todoId): todoId
        case .toggleHabit, .setTodaySet, .updatePreferences, .createHabit, .updateHabit, .deleteHabit,
             .createProject, .renameProject, .deleteProject: nil
        }
    }
}
