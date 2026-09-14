import Foundation

/// A calendar block that may occupy working time (mirrors `BusyBlock` in `src/lib/availability.ts`).
public protocol BusyBlock {
    var startTime: Date { get }
    var endTime: Date { get }
    var allDay: Bool { get }
}

/// A plain busy block, for callers that don't have a `CalendarEvent`.
public struct TimeBlock: BusyBlock, Hashable, Sendable {
    public var startTime: Date
    public var endTime: Date
    public var allDay: Bool

    public init(startTime: Date, endTime: Date, allDay: Bool = false) {
        self.startTime = startTime
        self.endTime = endTime
        self.allDay = allDay
    }
}

public struct DayAvailability: Hashable, Sendable {
    public var windowStart: Date
    public var windowEnd: Date
    /// Minutes between max(now, day start) and day end; 0 once the day is over.
    public var windowMinutes: Int
    /// Minutes of timed events inside the window, overlaps merged.
    public var busyMinutes: Int
    public var freeMinutes: Int
}

/// Port of `src/lib/availability.ts`: does the planned work fit in the hours left today?
public enum Availability {
    public static let DEFAULT_WORK_DAY_START = "09:00"
    public static let DEFAULT_WORK_DAY_END = "17:00"

    /// Only nag when the gap is bigger than rounding noise.
    public static let OVERCOMMIT_THRESHOLD_MINUTES = 30

    /// "09:00" → the same wall-clock time on `day`, or nil when the string is malformed.
    public static func clockOnDay(_ day: Date, _ hhmm: String, calendar: Calendar = .current) -> Date? {
        let parts = hhmm.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count == 2,
              (1...2).contains(parts[0].count), parts[1].count == 2,
              parts[0].allSatisfy(\.isASCIIDigit), parts[1].allSatisfy(\.isASCIIDigit),
              let h = Int(parts[0]), let m = Int(parts[1]),
              h <= 23, m <= 59
        else { return nil }
        var c = calendar.dateComponents([.year, .month, .day], from: day)
        c.hour = h
        c.minute = m
        c.second = 0
        c.nanosecond = 0
        return calendar.date(from: c)
    }

    private static func mergedBusyMinutes(_ events: [some BusyBlock], windowStart: Date, windowEnd: Date) -> Int {
        // All-day events are stored at noon UTC and are not blocking time.
        let blocks = events
            .filter { !$0.allDay }
            .map { (start: max($0.startTime.timeIntervalSince1970, windowStart.timeIntervalSince1970),
                    end: min($0.endTime.timeIntervalSince1970, windowEnd.timeIntervalSince1970)) }
            .filter { $0.end > $0.start }
            .sorted { $0.start < $1.start }

        var total: TimeInterval = 0
        var current: (start: TimeInterval, end: TimeInterval)? = nil
        for block in blocks {
            if let c = current, block.start <= c.end {
                current = (c.start, max(c.end, block.end))
            } else {
                if let c = current { total += c.end - c.start }
                current = block
            }
        }
        if let c = current { total += c.end - c.start }
        return TimeMath.jsRound(total / 60)
    }

    public static func computeAvailability(
        now: Date, dayStart: String, dayEnd: String, events: [some BusyBlock], calendar: Calendar = .current
    ) -> DayAvailability {
        let start = clockOnDay(now, dayStart, calendar: calendar) ?? clockOnDay(now, DEFAULT_WORK_DAY_START, calendar: calendar)!
        let end = clockOnDay(now, dayEnd, calendar: calendar) ?? clockOnDay(now, DEFAULT_WORK_DAY_END, calendar: calendar)!
        let windowStart = max(now, start)
        let windowEnd = end

        if windowEnd <= windowStart {
            return DayAvailability(windowStart: windowStart, windowEnd: windowEnd, windowMinutes: 0, busyMinutes: 0, freeMinutes: 0)
        }

        let windowMinutes = TimeMath.jsRound(windowEnd.timeIntervalSince(windowStart) / 60)
        let busyMinutes = mergedBusyMinutes(events, windowStart: windowStart, windowEnd: windowEnd)
        return DayAvailability(
            windowStart: windowStart,
            windowEnd: windowEnd,
            windowMinutes: windowMinutes,
            busyMinutes: busyMinutes,
            freeMinutes: max(0, windowMinutes - busyMinutes)
        )
    }

    /// Planned minus free; positive means the plan doesn't fit.
    public static func overcommitMinutes(_ availability: DayAvailability, plannedMinutes: Int) -> Int {
        plannedMinutes - availability.freeMinutes
    }

    private static func roundTo5(_ mins: Int) -> Int {
        TimeMath.jsRound(Double(mins) / 5) * 5
    }

    /// One gentle sentence when the plan overruns the free time by more than the
    /// threshold; nil when it fits, when the gap is small, or once the day is over.
    public static func overcommitMessage(
        _ availability: DayAvailability, plannedMinutes: Int, calendar: Calendar = .current
    ) -> String? {
        if availability.windowMinutes <= 0 { return nil }
        if overcommitMinutes(availability, plannedMinutes: plannedMinutes) <= OVERCOMMIT_THRESHOLD_MINUTES { return nil }

        let planned = TimeMath.formatMinutes(plannedMinutes)
        let free = roundTo5(availability.freeMinutes)
        let until = TimeMath.formatClock(availability.windowEnd, calendar: calendar)
        let room = free > 0 ? "roughly \(TimeMath.formatMinutes(free)) free before \(until)" : "no time free before \(until)"
        return "About \(planned) planned, and \(room). Want to move something to tomorrow?"
    }

    /// The whole check for a page: today's timed events, the working-hours window, and
    /// the minutes still planned. `timer` narrows the active task to what's left of its
    /// estimate; pass nil when nothing is running.
    public static func todayOvercommitMessage<T: Estimable & Identifiable>(
        todos: [T],
        timer: TimerSnapshot?,
        events: [some BusyBlock],
        dayStart: String,
        dayEnd: String,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> String? where T.ID == UUID {
        if todos.isEmpty { return nil }
        let todayKey = DayMath.isoDateString(now, calendar: calendar)
        let todaysEvents = events.filter { DayMath.isoDateString($0.startTime, calendar: calendar) == todayKey }
        let availability = computeAvailability(now: now, dayStart: dayStart, dayEnd: dayEnd, events: todaysEvents, calendar: calendar)
        return overcommitMessage(availability, plannedMinutes: TimeMath.remainingMinutes(todos, timer: timer), calendar: calendar)
    }
}

private extension Character {
    var isASCIIDigit: Bool { isASCII && isNumber }
}
