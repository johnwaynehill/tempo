import Foundation
import Testing
@testable import TempoKit

@Suite struct ProjectTests {
    let now = LA.at(9, 0, on: LA.day(2026, 10, 15))

    func snapshot(projects: [Project], todoProjects: [String?]) -> CacheSnapshot {
        CacheSnapshot(
            todos: todoProjects.map { Todo(draft: TodoDraft(title: "t", project: $0), userId: "", createdAt: now) },
            projects: projects
        )
    }

    @Test func createDoesNotDuplicateAnIdOrAName() {
        var s = CacheSnapshot.empty
        let draft = ProjectDraft(name: "Garden")
        s.apply(.createProject(createdAt: now, draft: draft))
        s.apply(.createProject(createdAt: now, draft: draft))
        s.apply(.createProject(createdAt: now, draft: ProjectDraft(name: "Garden")))
        #expect(s.projects.map(\.name) == ["Garden"])
        #expect(s.projects.first?.id == draft.id)
    }

    @Test func renameCarriesOverToItsTodosOnly() {
        let garden = Project(name: "Garden")
        var s = snapshot(projects: [garden, Project(name: "Work")], todoProjects: ["Garden", "Work", nil, "Garden"])
        let op = WriteOp.renameProject(createdAt: now, projectId: garden.id, name: "Yard")
        s.apply(op)
        #expect(s.projects.map(\.name) == ["Yard", "Work"])
        #expect(s.todos.map(\.project) == ["Yard", "Work", nil, "Yard"])

        s.apply(op)
        #expect(s.todos.map(\.project) == ["Yard", "Work", nil, "Yard"], "replaying a rename is harmless")
    }

    @Test func deleteClearsTheLabelButKeepsTheTodos() {
        let garden = Project(name: "Garden")
        var s = snapshot(projects: [garden], todoProjects: ["Garden", "Work"])
        s.apply(.deleteProject(createdAt: now, projectId: garden.id))
        #expect(s.projects.isEmpty)
        #expect(s.todos.map(\.project) == [nil, "Work"])
    }

    @Test func projectOpsRoundTripThroughJSON() throws {
        let ops: [WriteOp] = [
            .createProject(createdAt: now, draft: ProjectDraft(name: "Garden")),
            .renameProject(createdAt: now, projectId: UUID(), name: "Yard"),
            .deleteProject(createdAt: now, projectId: UUID()),
        ]
        let decoded = try TempoJSON.decoder.decode([WriteOp].self, from: TempoJSON.encoder.encode(ops))
        #expect(decoded == ops)
    }
}
