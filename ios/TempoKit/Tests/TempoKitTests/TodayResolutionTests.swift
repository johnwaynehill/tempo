import Foundation
import Testing
@testable import TempoKit

@Suite struct TodayResolutionTests {
    let p1 = Todo.fixture("p1", status: .todayPinned)
    let b1 = Todo.fixture("b1", status: .backlog)
    let b2 = Todo.fixture("b2", status: .backlog)
    let p2 = Todo.fixture("p2 (pinned but not in pinned list)", status: .todayPinned)
    let d1 = Todo.fixture("d1", status: .done)
    let i1 = Todo.fixture("i1", status: .inbox)
    let df = Todo.fixture("df", status: .deferred)
    var todos: [Todo] { [p1, b1, b2, p2, d1, i1, df] }

    @Test func pinnedFirstThenSetInOrder() {
        let set = TodaySet(date: "2026-09-14", todoIds: [b2.id, p1.id, d1.id, UUID(), i1.id, df.id, p2.id, b1.id])
        let result = TodayResolution.resolveTodayTodos(todaySet: set, todos: todos, pinned: [p1], today: "2026-09-14")
        #expect(result.map(\.id) == [p1.id, b2.id, p2.id, b1.id])
    }

    @Test func noSetReturnsPinned() {
        #expect(TodayResolution.resolveTodayTodos(todaySet: nil, todos: todos, pinned: [p1]).map(\.id) == [p1.id])
        let stale = TodaySet(date: "2026-09-13", todoIds: [b1.id])
        #expect(TodayResolution.resolveTodayTodos(todaySet: stale, todos: todos, pinned: [p1], today: "2026-09-14").map(\.id) == [p1.id])
        // Without a `today`, the set's date is trusted.
        #expect(TodayResolution.resolveTodayTodos(todaySet: stale, todos: todos, pinned: [p1]).map(\.id) == [p1.id, b1.id])
    }

    @Test func todayDateString() {
        #expect(TodayResolution.todayDateString(now: fixedNow, calendar: LA.calendar) == "2026-09-14")
        // 06:30Z on the 14th is still the 13th in LA.
        #expect(TodayResolution.todayDateString(now: LA.at(23, 30, on: LA.day(2026, 9, 13)), calendar: LA.calendar) == "2026-09-13")
    }
}
