import Foundation
import Testing
@testable import TempoKit

@Suite struct InsightsTests {
    let cal = LA.calendar
    let now = fixedNow // Mon 2026-09-14 12:00 PDT

    @Test func countsAndProjectBreakdownWithinRange() {
        let done: [Todo] = [
            .fixture("in range, on time", status: .done, project: "Work",
                     dueDate: LA.at(23, 0, on: LA.day(2026, 9, 12)), completedAt: LA.at(9, 0, on: LA.day(2026, 9, 12))),
            .fixture("in range, late", status: .done, project: "Work",
                     dueDate: LA.at(9, 0, on: LA.day(2026, 9, 10)), completedAt: LA.at(9, 0, on: LA.day(2026, 9, 12))),
            .fixture("in range, no due date", status: .done, project: "Home", completedAt: LA.at(9, 0, on: LA.day(2026, 9, 13))),
            .fixture("out of range", status: .done, project: "Work", completedAt: LA.at(9, 0, on: LA.day(2026, 9, 1))),
        ]
        let range = (start: LA.day(2026, 9, 8), end: LA.day(2026, 9, 14))
        let data = Insights.compute(done: done, range: range, calendar: cal)

        #expect(data.totalCompleted == 3)
        #expect(data.completedOnTime == 1)
        #expect(data.completedLate == 1)
        #expect(data.completedNoDueDate == 1)
        #expect(data.byProject.first?.project == "Work")
        #expect(data.byProject.first?.count == 2)
        #expect(data.topProject == "Work")
    }

    @Test func ungroupedBucketsMissingProject() {
        let done: [Todo] = [.fixture("no project", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 9, 13)))]
        let range = (start: LA.day(2026, 9, 8), end: LA.day(2026, 9, 14))
        let data = Insights.compute(done: done, range: range, calendar: cal)
        #expect(data.byProject == [ProjectBreakdown(project: "Ungrouped", count: 1, onTime: 0, late: 0)])
    }

    @Test func currentStreakAllowsTodayOrYesterday() {
        let done: [Todo] = [
            .fixture("today", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 9, 14))),
            .fixture("yesterday", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 9, 13))),
            .fixture("day before", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 9, 12))),
        ]
        let range = (start: LA.day(2026, 9, 8), end: LA.day(2026, 9, 14))
        let data = Insights.compute(done: done, range: range, calendar: cal, now: now)
        #expect(data.currentStreak == 3)
        #expect(data.bestStreak == 3)
    }

    @Test func bestStreakCanExceedCurrent() {
        let done: [Todo] = [
            // A 3-day streak two weeks ago, then a gap, then just today.
            .fixture("today", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 9, 14))),
            .fixture("a", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 8, 28))),
            .fixture("b", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 8, 29))),
            .fixture("c", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 8, 30))),
        ]
        let range = (start: LA.day(2026, 8, 1), end: LA.day(2026, 9, 14))
        let data = Insights.compute(done: done, range: range, calendar: cal, now: now)
        #expect(data.currentStreak == 1)
        #expect(data.bestStreak == 3)
    }

    @Test func emptyRangeIsEmptyNotCrashing() {
        let range = (start: LA.day(2026, 9, 8), end: LA.day(2026, 9, 14))
        let data = Insights.compute(done: [], range: range, calendar: cal, now: now)
        #expect(data.totalCompleted == 0)
        #expect(data.byProject.isEmpty)
        #expect(data.mostProductiveDay == nil)
        #expect(data.topProject == nil)
        #expect(data.bestStreak == 0)
        #expect(data.dailyTrend.count == 7)
    }

    @Test func mostProductiveDayNamesTheWeekday() {
        // 2026-09-14 is a Monday.
        let done: [Todo] = [
            .fixture("m1", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 9, 14))),
            .fixture("m2", status: .done, completedAt: LA.at(10, 0, on: LA.day(2026, 9, 14))),
            .fixture("t1", status: .done, completedAt: LA.at(9, 0, on: LA.day(2026, 9, 15))),
        ]
        let range = (start: LA.day(2026, 9, 8), end: LA.day(2026, 9, 20))
        let data = Insights.compute(done: done, range: range, calendar: cal, now: now)
        #expect(data.mostProductiveDay == "Monday")
    }
}
