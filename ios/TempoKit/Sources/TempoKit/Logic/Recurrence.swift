import Foundation

/// Port of `src/lib/recurrence.ts`.
public enum Recurrence {
    private static let dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    /// Compute the next occurrence date given a recurrence rule. `fromDate` is the
    /// current due date or today. The result is midnight in `calendar`'s time zone.
    public static func getNextOccurrence(_ rule: RecurrenceRule, from fromDate: Date, calendar: Calendar = .current) -> Date {
        let next = DayMath.startOfDay(fromDate, calendar: calendar)

        switch rule.frequency {
        case .daily:
            return DayMath.adding(days: 1, to: next, calendar: calendar)

        case .weekly:
            guard let days = rule.daysOfWeek, !days.isEmpty else {
                // Default: same day next week
                return DayMath.adding(days: 7, to: next, calendar: calendar)
            }
            // Find the next matching day of week after fromDate
            let currentDay = DayMath.weekday(next, calendar: calendar)
            let sorted = days.sorted()
            if let nextDay = sorted.first(where: { $0 > currentDay }) {
                return DayMath.adding(days: nextDay - currentDay, to: next, calendar: calendar)
            }
            // Wrap to next week, pick first day
            let daysUntilNext = 7 - currentDay + sorted[0]
            return DayMath.adding(days: daysUntilNext, to: next, calendar: calendar)

        case .monthly:
            let targetDay = rule.dayOfMonth ?? calendar.component(.day, from: fromDate)
            var first = calendar.dateComponents([.year, .month], from: next)
            first.day = 1
            let firstOfThisMonth = calendar.date(from: first) ?? next
            let firstOfNextMonth = calendar.date(byAdding: .month, value: 1, to: firstOfThisMonth) ?? next
            // Clamp to last day of target month
            let lastDay = calendar.range(of: .day, in: .month, for: firstOfNextMonth)?.count ?? 28
            var target = calendar.dateComponents([.year, .month], from: firstOfNextMonth)
            target.day = min(targetDay, lastDay)
            return calendar.date(from: target) ?? next
        }
    }

    /// Human-readable description of a recurrence rule.
    public static func describeRecurrence(_ rule: RecurrenceRule) -> String {
        switch rule.frequency {
        case .daily:
            return "Every day"

        case .weekly:
            guard let days = rule.daysOfWeek, !days.isEmpty else { return "Every week" }
            if days.count == 7 { return "Every day" }
            if days.count == 5 && [1, 2, 3, 4, 5].allSatisfy(days.contains) { return "Weekdays" }
            if days.count == 2 && [0, 6].allSatisfy(days.contains) { return "Weekends" }
            return days.map { dayNamesShort.indices.contains($0) ? dayNamesShort[$0] : "?" }.joined(separator: ", ")

        case .monthly:
            guard let day = rule.dayOfMonth, day != 0 else { return "Every month" }
            let suffix: String = switch day {
            case 1, 21, 31: "st"
            case 2, 22: "nd"
            case 3, 23: "rd"
            default: "th"
            }
            return "Monthly on the \(day)\(suffix)"
        }
    }
}
