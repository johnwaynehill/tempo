import Foundation
import Testing
@testable import TempoKit

@Suite struct StreaksTests {
    let cal = LA.calendar
    let now = fixedNow // Mon 2026-09-14 12:00 PDT

    @Test func consecutiveDaysIncludingToday() {
        let r = Streaks.currentStreak(completions: [LA.at(9, 0, on: LA.day(2026, 9, 14)), LA.at(9, 0, on: LA.day(2026, 9, 13)), LA.at(22, 0, on: LA.day(2026, 9, 12))], now: now, calendar: cal)
        #expect(r == StreakResult(currentStreak: 3, hasCompletedToday: true))
    }

    @Test func nothingTodayStillCountsYesterday() {
        let r = Streaks.currentStreak(completions: [LA.at(9, 0, on: LA.day(2026, 9, 13)), LA.at(9, 0, on: LA.day(2026, 9, 12))], now: now, calendar: cal)
        #expect(r == StreakResult(currentStreak: 2, hasCompletedToday: false))
    }

    @Test func gapBreaksStreak() {
        #expect(Streaks.currentStreak(completions: [LA.at(9, 0, on: LA.day(2026, 9, 12))], now: now, calendar: cal) == StreakResult(currentStreak: 0, hasCompletedToday: false))
        #expect(Streaks.currentStreak(completions: [LA.at(9, 0, on: LA.day(2026, 9, 14)), LA.at(9, 0, on: LA.day(2026, 9, 12))], now: now, calendar: cal) == StreakResult(currentStreak: 1, hasCompletedToday: true))
        #expect(Streaks.currentStreak(completions: [], now: now, calendar: cal) == StreakResult(currentStreak: 0, hasCompletedToday: false))
    }

    @Test func dayBoundaryIsLocal() {
        // 23:30 PDT on the 13th is 06:30Z on the 14th; it must count as the 13th.
        let lateLastNight = LA.at(23, 30, on: LA.day(2026, 9, 13))
        let r = Streaks.currentStreak(completions: [LA.at(1, 0, on: LA.day(2026, 9, 14)), lateLastNight], now: now, calendar: cal)
        #expect(r.currentStreak == 2)
    }

    @Test func onlyDoneTodosCount() {
        let todos: [Todo] = [
            .fixture("done today", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 9, 14))),
            .fixture("backlog with stray completedAt", status: .backlog, completedAt: LA.at(9, 0, on: LA.day(2026, 9, 13))),
            .fixture("done without date", status: .done),
        ]
        #expect(Streaks.currentStreak(done: todos, now: now, calendar: cal) == StreakResult(currentStreak: 1, hasCompletedToday: true))
    }
}
