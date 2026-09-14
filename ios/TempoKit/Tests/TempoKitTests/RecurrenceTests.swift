import Foundation
import Testing
@testable import TempoKit

@Suite struct RecurrenceTests {
    let cal = LA.calendar

    func next(_ rule: RecurrenceRule, from: Date) -> Date {
        Recurrence.getNextOccurrence(rule, from: from, calendar: cal)
    }

    @Test func daily() {
        #expect(next(RecurrenceRule(frequency: .daily), from: LA.day(2026, 9, 13)) == LA.day(2026, 9, 14))
        // Time of day is dropped
        #expect(next(RecurrenceRule(frequency: .daily), from: LA.at(17, 45)) == LA.day(2026, 9, 14))
        // Month roll
        #expect(next(RecurrenceRule(frequency: .daily), from: LA.day(2026, 9, 30)) == LA.day(2026, 10, 1))
    }

    @Test func weekly() {
        let mwf = RecurrenceRule(frequency: .weekly, daysOfWeek: [5, 1, 3])
        // Sun Sep 13 → Mon Sep 14
        #expect(next(mwf, from: LA.day(2026, 9, 13)) == LA.day(2026, 9, 14))
        // Wed Sep 16 → Fri Sep 18
        #expect(next(mwf, from: LA.day(2026, 9, 16)) == LA.day(2026, 9, 18))
        // Fri Sep 18 wraps → Mon Sep 21
        #expect(next(mwf, from: LA.day(2026, 9, 18)) == LA.day(2026, 9, 21))
        // Same-day rule never returns the same day: Mon with [1] → next Mon
        #expect(next(RecurrenceRule(frequency: .weekly, daysOfWeek: [1]), from: LA.day(2026, 9, 14)) == LA.day(2026, 9, 21))
        // No days: same day next week
        #expect(next(RecurrenceRule(frequency: .weekly), from: LA.day(2026, 9, 13)) == LA.day(2026, 9, 20))
        #expect(next(RecurrenceRule(frequency: .weekly, daysOfWeek: []), from: LA.day(2026, 9, 13)) == LA.day(2026, 9, 20))
    }

    @Test func monthly() {
        // Jan 31 → Feb 28 (2026 is not a leap year)
        #expect(next(RecurrenceRule(frequency: .monthly, dayOfMonth: 31), from: LA.day(2026, 1, 31)) == LA.day(2026, 2, 28))
        // Clamped again on the way out: Mar 31 → Apr 30
        #expect(next(RecurrenceRule(frequency: .monthly, dayOfMonth: 31), from: LA.day(2026, 3, 31)) == LA.day(2026, 4, 30))
        // No day_of_month: keep the from-date's day
        #expect(next(RecurrenceRule(frequency: .monthly), from: LA.day(2026, 1, 15)) == LA.day(2026, 2, 15))
        #expect(next(RecurrenceRule(frequency: .monthly), from: LA.day(2026, 1, 30)) == LA.day(2026, 2, 28))
        // Year roll
        #expect(next(RecurrenceRule(frequency: .monthly, dayOfMonth: 15), from: LA.day(2026, 12, 15)) == LA.day(2027, 1, 15))
        // Leap year keeps the 29th
        #expect(next(RecurrenceRule(frequency: .monthly, dayOfMonth: 31), from: LA.day(2028, 1, 31)) == LA.day(2028, 2, 29))
    }

    @Test func describe() {
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .daily)) == "Every day")
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .weekly)) == "Every week")
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .weekly, daysOfWeek: [0, 1, 2, 3, 4, 5, 6])) == "Every day")
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .weekly, daysOfWeek: [5, 4, 3, 2, 1])) == "Weekdays")
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .weekly, daysOfWeek: [6, 0])) == "Weekends")
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .weekly, daysOfWeek: [1, 3, 5])) == "Mon, Wed, Fri")
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .monthly)) == "Every month")
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .monthly, dayOfMonth: 1)) == "Monthly on the 1st")
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .monthly, dayOfMonth: 22)) == "Monthly on the 22nd")
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .monthly, dayOfMonth: 23)) == "Monthly on the 23rd")
        #expect(Recurrence.describeRecurrence(RecurrenceRule(frequency: .monthly, dayOfMonth: 11)) == "Monthly on the 11th")
    }
}
