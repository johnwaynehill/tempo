import Foundation
import Testing
@testable import TempoKit

/// `CacheSnapshot.apply` is what the widget uses to preview writes still waiting in the App Group
/// inbox, so a completed task or a toggled habit shows before the app has imported them.
@Suite struct SnapshotApplyTests {
    @Test func completeAndToggleAreVisibleInTheSnapshot() throws {
        let todo = try TempoJSON.decoder.decode(Todo.self, from: Data(JSONTests.todoJSON.utf8))
        let habitId = UUID()
        var snapshot = CacheSnapshot.empty
        snapshot.upsert(todo)
        snapshot.upsert(Habit(id: habitId, name: "Stretch"))

        let at = Date(timeIntervalSince1970: 1_800_000_000)
        snapshot.apply(.completeTodo(createdAt: at, todoId: todo.id, actualMinutes: 20))
        snapshot.apply(.toggleHabit(createdAt: at, habitId: habitId, date: "2026-10-15", completed: true))

        #expect(snapshot.todo(id: todo.id)?.status == .done)
        #expect(snapshot.todo(id: todo.id)?.actualMinutes == 20)
        #expect(snapshot.todo(id: todo.id)?.completedAt == at)
        #expect(snapshot.habits.first?.isCompleted(on: "2026-10-15") == true)

        // Replaying the same ops is harmless, and un-toggling removes the key.
        snapshot.apply(.completeTodo(createdAt: at, todoId: todo.id, actualMinutes: 20))
        snapshot.apply(.toggleHabit(createdAt: at, habitId: habitId, date: "2026-10-15", completed: false))
        #expect(snapshot.todo(id: todo.id)?.status == .done)
        #expect(snapshot.habits.first?.completions["2026-10-15"] == nil)
    }
}
