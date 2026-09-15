import Foundation
@testable import TempoKit

/// Every test pins Los Angeles so day math is deterministic on any machine.
enum LA {
    static let timeZone = TimeZone(identifier: "America/Los_Angeles")!
    static let calendar = DayMath.calendar(timeZone: timeZone)

    /// Midnight on the given LA calendar day.
    static func day(_ year: Int, _ month: Int, _ day: Int) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day))!
    }

    /// Wall-clock time on the given LA day (defaults to 2026-09-13, the availability fixture day).
    static func at(_ hour: Int, _ minute: Int = 0, on day: Date = LA.day(2026, 9, 13)) -> Date {
        var c = calendar.dateComponents([.year, .month, .day], from: day)
        c.hour = hour
        c.minute = minute
        return calendar.date(from: c)!
    }
}

/// Fixed "now" for calibration/scoring/streak fixtures: Mon 2026-09-14 12:00 PDT.
let fixedNow = LA.at(12, 0, on: LA.day(2026, 9, 14))

func daysAgo(_ n: Double, from now: Date = fixedNow) -> Date {
    now.addingTimeInterval(-n * 86_400)
}

extension Todo {
    /// A backlog todo with sensible defaults for logic tests.
    static func fixture(
        _ title: String,
        id: UUID = UUID(),
        status: TodoStatus = .backlog,
        project: String? = nil,
        size: TodoSize? = nil,
        impact: Int? = nil,
        energyLevel: EnergyLevel? = nil,
        estimatedMinutes: Int? = nil,
        actualMinutes: Int? = nil,
        dueDate: Date? = nil,
        deferUntil: Date? = nil,
        dismissedFromToday: Date? = nil,
        createdAt: Date = fixedNow,
        completedAt: Date? = nil
    ) -> Todo {
        Todo(
            id: id, userId: "u", title: title, status: status, project: project, size: size, impact: impact,
            energyLevel: energyLevel, dueDate: dueDate, deferUntil: deferUntil,
            dismissedFromToday: dismissedFromToday, estimatedMinutes: estimatedMinutes,
            actualMinutes: actualMinutes, createdAt: createdAt, updatedAt: createdAt, completedAt: completedAt
        )
    }
}
