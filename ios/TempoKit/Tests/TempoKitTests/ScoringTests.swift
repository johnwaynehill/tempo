import Foundation
import Testing
@testable import TempoKit

@Suite struct ScoringTests {
    let cal = LA.calendar
    let now = fixedNow // Mon 2026-09-14 12:00 PDT
    let today = LA.day(2026, 9, 14)

    @Test func dueDateUrgency() {
        #expect(Scoring.dueDateUrgency(nil, now: now, calendar: cal) == 0.2)
        #expect(Scoring.dueDateUrgency(LA.day(2026, 9, 10), now: now, calendar: cal) == 1.0)
        #expect(Scoring.dueDateUrgency(LA.at(23, 59, on: today), now: now, calendar: cal) == 1.0)
        #expect(Scoring.dueDateUrgency(LA.day(2026, 9, 15), now: now, calendar: cal) == 0.7)
        #expect(Scoring.dueDateUrgency(LA.day(2026, 9, 21), now: now, calendar: cal) == 0.4)
        #expect(Scoring.dueDateUrgency(LA.day(2026, 9, 22), now: now, calendar: cal) == 0.1)
    }

    @Test func energyAndStaleness() {
        #expect(Scoring.energyMatch(nil, .high) == 0.5)
        #expect(Scoring.energyMatch(.high, .high) == 1.0)
        #expect(Scoring.energyMatch(.medium, .high) == 0.5)
        #expect(Scoring.energyMatch(.low, .high) == 0.0)
        #expect(Scoring.staleness(now, now: now) == 0)
        #expect(Scoring.staleness(daysAgo(15), now: now) == 0.5)
        #expect(Scoring.staleness(daysAgo(90), now: now) == 1.0)
    }

    @Test func scoreTodo() {
        let hot = Todo.fixture("hot", impact: 5, energyLevel: .high, dueDate: today, createdAt: now)
        #expect(Scoring.scoreTodo(hot, currentEnergy: .high, now: now, calendar: cal) == 105)
        #expect(Scoring.scoreTodo(hot, currentEnergy: nil, now: now, calendar: cal) == 92.5)
        let later = Todo.fixture("later", impact: 1, energyLevel: .low, dueDate: LA.day(2026, 10, 30), createdAt: daysAgo(30))
        // 0.1*40 + 8 + 0 + 10
        #expect(Scoring.scoreTodo(later, currentEnergy: .high, now: now, calendar: cal) == 22)
        // impact defaults to 3
        #expect(Scoring.scoreTodo(Todo.fixture("plain", createdAt: now), now: now, calendar: cal) == 0.2 * 40 + 24 + 12.5)
    }

    @Test func gatedProjectMatching() {
        #expect(Scoring.isDueDateGatedProject("chore"))
        #expect(Scoring.isDueDateGatedProject("  Chore "))
        #expect(!Scoring.isDueDateGatedProject("chores"))
        #expect(!Scoring.isDueDateGatedProject(nil))
        #expect(!Scoring.isDueDateGatedProject(""))
    }

    @Test func suggestFixture() {
        let pinned = Todo.fixture("pinned", status: .todayPinned, impact: 5, dueDate: today)
        let inbox = Todo.fixture("inbox", status: .inbox, impact: 5, dueDate: today)
        let deferredLater = Todo.fixture("deferred later", status: .deferred, impact: 5, dueDate: today, deferUntil: now.addingTimeInterval(3600))
        let deferredPast = Todo.fixture("deferred past", status: .deferred, impact: 2, deferUntil: now.addingTimeInterval(-3600))
        let dismissedToday = Todo.fixture("dismissed today", impact: 5, dueDate: today, dismissedFromToday: LA.at(8, 0, on: today))
        let dismissedYesterday = Todo.fixture("dismissed yesterday", impact: 4, dismissedFromToday: LA.at(20, 0, on: LA.day(2026, 9, 13)))
        let done = Todo.fixture("done", status: .done, impact: 5, dueDate: today)
        let choreBeforeDue = Todo.fixture("chore before due", project: "Chore", impact: 5, dueDate: LA.day(2026, 9, 15))
        let choreNoDue = Todo.fixture("chore no due", project: "chore", impact: 5)
        let choreDueToday = Todo.fixture("chore today", project: " chore ", impact: 1, dueDate: LA.at(9, 0, on: today))
        let choreOverdue = Todo.fixture("chore overdue", project: "Chore", impact: 1, dueDate: LA.day(2026, 9, 11))
        let choreDone = Todo.fixture("chore done", status: .done, project: "Chore", dueDate: LA.day(2026, 9, 1))
        let urgent = Todo.fixture("urgent", impact: 5, energyLevel: .high, dueDate: today, createdAt: now)
        let medium = Todo.fixture("medium", impact: 3, dueDate: LA.day(2026, 9, 15), createdAt: now)
        let low = Todo.fixture("low", impact: 1, createdAt: now)

        let all = [pinned, inbox, deferredLater, deferredPast, dismissedToday, dismissedYesterday, done,
                   choreBeforeDue, choreNoDue, choreDueToday, choreOverdue, choreDone, urgent, medium, low]

        let result = Scoring.suggestTodayTodos(all, currentEnergy: .high, pinnedCount: 1, limit: 5, now: now, calendar: cal)
        let ids = result.map(\.id)

        // Overdue chore leads, then today's chore, then discretionary by score.
        #expect(ids.first == choreOverdue.id)
        #expect(ids[1] == choreDueToday.id)
        // 5 - 1 pinned - 2 mandatory = 2 discretionary slots: urgent (105) and medium (0.7*40 + 24 + 12.5 = 64.5)
        #expect(ids.count == 4)
        #expect(ids[2] == urgent.id)
        #expect(ids[3] == medium.id)

        for excluded in [pinned, inbox, deferredLater, dismissedToday, done, choreBeforeDue, choreNoDue, choreDone] {
            #expect(!ids.contains(excluded.id), "\(excluded.title) should be excluded")
        }

        // With more room, the rest come in by score: dismissedYesterday 52.5, deferredPast 36.5, low 28.5.
        let wide = Scoring.suggestTodayTodos(all, currentEnergy: .high, pinnedCount: 0, limit: 10, now: now, calendar: cal).map(\.id)
        #expect(wide == [choreOverdue.id, choreDueToday.id, urgent.id, medium.id, dismissedYesterday.id, deferredPast.id, low.id])
    }

    @Test func mandatoryIsAdditive() {
        let chores = (1...6).map { Todo.fixture("chore \($0)", project: "Chore", dueDate: LA.day(2026, 9, 14 - $0)) }
        let filler = Todo.fixture("filler", impact: 5)
        let result = Scoring.suggestTodayTodos(chores + [filler], pinnedCount: 0, limit: 5, now: now, calendar: cal)
        #expect(result.count == 6)
        #expect(result.map(\.title) == ["chore 6", "chore 5", "chore 4", "chore 3", "chore 2", "chore 1"])
        #expect(!result.map(\.id).contains(filler.id))
    }
}
