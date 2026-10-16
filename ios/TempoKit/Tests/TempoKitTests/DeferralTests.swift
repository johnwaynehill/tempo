import Foundation
import Testing
@testable import TempoKit

@Suite struct DeferralTests {
    let now = Date(timeIntervalSince1970: 1_800_000_000)

    @Test func aFutureDeferralIsHiddenUntilItsDate() {
        let later = Todo(title: "Later", status: .deferred, deferUntil: now.addingTimeInterval(3600))
        #expect(later.isDeferred(at: now))
        #expect(!later.isBacklogCandidate(at: now))
        #expect(later.isBacklogCandidate(at: now.addingTimeInterval(7200)), "back in the Backlog once the date passes")
    }

    @Test func aDeferralWithoutADateCannotStayInvisible() {
        let undated = Todo(title: "No date", status: .deferred, deferUntil: nil)
        #expect(!undated.isDeferred(at: now))
        #expect(undated.isBacklogCandidate(at: now))
    }

    @Test func otherStatusesAreUnaffected() {
        #expect(Todo(title: "B", status: .backlog).isBacklogCandidate(at: now))
        #expect(!Todo(title: "I", status: .inbox).isBacklogCandidate(at: now))
        #expect(!Todo(title: "D", status: .done).isBacklogCandidate(at: now))
        #expect(!Todo(title: "P", status: .todayPinned).isBacklogCandidate(at: now))
    }
}
