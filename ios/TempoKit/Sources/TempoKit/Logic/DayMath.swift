import Foundation

/// Calendar helpers shared by the logic ports. Every function takes the `Calendar`
/// (and therefore the time zone) explicitly so tests are deterministic; callers
/// default to `.current`.
public enum DayMath {
    /// Midnight at the start of `date`'s calendar day.
    public static func startOfDay(_ date: Date, calendar: Calendar = .current) -> Date {
        calendar.startOfDay(for: date)
    }

    /// `yyyy-MM-dd` in the calendar's time zone (mirrors `toISODateString`).
    public static func isoDateString(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    public static func isSameDay(_ a: Date, _ b: Date, calendar: Calendar = .current) -> Bool {
        calendar.isDate(a, inSameDayAs: b)
    }

    /// Whole calendar days from `from`'s day to `to`'s day (negative when `to` is earlier).
    public static func daysBetween(_ from: Date, _ to: Date, calendar: Calendar = .current) -> Int {
        calendar.dateComponents([.day], from: startOfDay(from, calendar: calendar), to: startOfDay(to, calendar: calendar)).day ?? 0
    }

    public static func adding(days: Int, to date: Date, calendar: Calendar = .current) -> Date {
        calendar.date(byAdding: .day, value: days, to: date) ?? date
    }

    /// 0 = Sunday … 6 = Saturday, like JavaScript's `getDay()`.
    public static func weekday(_ date: Date, calendar: Calendar = .current) -> Int {
        calendar.component(.weekday, from: date) - 1
    }

    /// A `Calendar` pinned to a time zone; handy for tests.
    public static func calendar(timeZone: TimeZone) -> Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = timeZone
        c.locale = Locale(identifier: "en_US_POSIX")
        return c
    }
}
