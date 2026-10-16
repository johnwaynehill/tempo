import Foundation
import Testing
@testable import TempoKit

@Suite struct HabitTests {
    let calendar = LA.calendar
    let now = LA.at(9, 0, on: LA.day(2026, 10, 15))

    func habit(_ keys: [String], createdDaysAgo: Int = 10) -> Habit {
        Habit(
            name: "Stretch",
            completions: Dictionary(uniqueKeysWithValues: keys.map { ($0, true) }),
            createdAt: now.addingTimeInterval(-Double(createdDaysAgo) * 86_400)
        )
    }

    @Test func currentStreakCountsBackFromYesterdayWhenTodayIsOpen() {
        let stats = HabitStatsCalculator.stats(for: habit(["2026-10-12", "2026-10-13", "2026-10-14"]), now: now, calendar: calendar)
        #expect(stats.currentStreak == 3)
        #expect(stats.bestStreak == 3)
        #expect(stats.totalCompletions == 3)
        #expect(stats.completionRate == 30)
    }

    @Test func bestStreakSurvivesABreak() {
        let stats = HabitStatsCalculator.stats(
            for: habit(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-14", "2026-10-15"], createdDaysAgo: 30),
            now: now, calendar: calendar
        )
        #expect(stats.currentStreak == 2)
        #expect(stats.bestStreak == 4)
    }

    @Test func rateIsCappedAndNeverDividesByZero() {
        let stats = HabitStatsCalculator.stats(for: habit(["2026-10-14", "2026-10-15"], createdDaysAgo: 0), now: now, calendar: calendar)
        #expect(stats.completionRate == 100)
    }

    @Test func habitOpsApplyToTheSnapshot() {
        var snapshot = CacheSnapshot.empty
        let draft = HabitDraft(name: "Read", description: "10 pages")
        snapshot.apply(.createHabit(createdAt: now, draft: draft))
        snapshot.apply(.createHabit(createdAt: now, draft: draft))
        #expect(snapshot.habits.count == 1, "replaying a create doesn't duplicate it")

        snapshot.apply(.updateHabit(createdAt: now, habitId: draft.id, update: HabitUpdate(name: "Read more", description: .null)))
        #expect(snapshot.habits.first?.name == "Read more")
        #expect(snapshot.habits.first?.description == nil)

        snapshot.apply(.deleteHabit(createdAt: now, habitId: draft.id))
        #expect(snapshot.habits.isEmpty)
    }

    @Test func habitOpsRoundTripThroughJSON() throws {
        let ops: [WriteOp] = [
            .createHabit(createdAt: now, draft: HabitDraft(name: "Walk")),
            .updateHabit(createdAt: now, habitId: UUID(), update: HabitUpdate(name: "Walk", description: .set("20 min"), archived: true)),
            .deleteHabit(createdAt: now, habitId: UUID()),
        ]
        let decoded = try TempoJSON.decoder.decode([WriteOp].self, from: TempoJSON.encoder.encode(ops))
        #expect(decoded == ops)
    }

    @Test func anUpdateOnlySendsWhatChanged() throws {
        let json = try JSONSerialization.jsonObject(with: TempoJSON.encoder.encode(HabitUpdate(description: .null))) as? [String: Any]
        #expect(json?.keys.sorted() == ["description"])
        #expect(json?["description"] is NSNull)
    }
}
