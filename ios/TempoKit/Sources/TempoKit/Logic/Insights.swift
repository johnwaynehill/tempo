import Foundation

/// Port of `src/hooks/useInsightsData.ts`: completion stats over a date range, used by
/// both Insights and Weekly Review. Pure function of `done` (completed todos) and the
/// range — no view-layer memoization needed since SwiftUI recomputes on demand.
public struct ProjectBreakdown: Hashable, Sendable {
    public var project: String
    public var count: Int
    public var onTime: Int
    public var late: Int
}

public struct TrendPoint: Hashable, Sendable, Identifiable {
    public var label: String
    public var value: Int
    public var id: String { label }
}

public struct InsightsData: Hashable, Sendable {
    public var totalCompleted: Int
    public var completedOnTime: Int
    public var completedLate: Int
    public var completedNoDueDate: Int

    public var byProject: [ProjectBreakdown]
    public var dailyTrend: [TrendPoint]
    public var weeklyTrend: [TrendPoint]
    public var monthlyTrend: [TrendPoint]

    public var currentStreak: Int
    public var bestStreak: Int
    public var avgPerDay: Double
    public var mostProductiveDay: String?
    public var topProject: String?

    /// Estimated vs actual minutes for timed completions in range.
    public var calibration: CalibrationSummary
}

public enum Insights {
    private static let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    private static let fullDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    /// Monday-anchored start of the week containing `date`, matching `getStartOfWeek` in dateUtils.ts.
    static func startOfWeek(_ date: Date, calendar: Calendar) -> Date {
        let day = DayMath.weekday(date, calendar: calendar) // 0 = Sunday
        let diff = day == 0 ? -6 : 1 - day
        return DayMath.startOfDay(DayMath.adding(days: diff, to: date, calendar: calendar), calendar: calendar)
    }

    static func endOfDay(_ date: Date, calendar: Calendar) -> Date {
        let start = DayMath.startOfDay(date, calendar: calendar)
        return calendar.date(byAdding: DateComponents(day: 1, second: -1), to: start) ?? date
    }

    public static func compute(done: [Todo], range: (start: Date, end: Date), calendar: Calendar = .current, now: Date = Date()) -> InsightsData {
        let rangeStart = DayMath.startOfDay(range.start, calendar: calendar)
        let rangeEnd = endOfDay(range.end, calendar: calendar)

        let inRange = done.filter { t in
            guard let c = t.completedAt else { return false }
            return c >= rangeStart && c <= rangeEnd
        }

        let totalCompleted = inRange.count

        var completedOnTime = 0
        var completedLate = 0
        var completedNoDueDate = 0
        for t in inRange {
            guard let due = t.dueDate, let completed = t.completedAt else { completedNoDueDate += 1; continue }
            if completed <= endOfDay(due, calendar: calendar) { completedOnTime += 1 } else { completedLate += 1 }
        }

        // By project
        var projectOrder: [String] = []
        var projectMap: [String: (count: Int, onTime: Int, late: Int)] = [:]
        for t in inRange {
            let key = (t.project?.isEmpty == false ? t.project! : "Ungrouped")
            var entry = projectMap[key] ?? (0, 0, 0)
            if projectMap[key] == nil { projectOrder.append(key) }
            entry.count += 1
            if let due = t.dueDate, let completed = t.completedAt {
                if completed <= endOfDay(due, calendar: calendar) { entry.onTime += 1 } else { entry.late += 1 }
            }
            projectMap[key] = entry
        }
        let byProject = projectOrder
            .map { key -> ProjectBreakdown in
                let e = projectMap[key]!
                return ProjectBreakdown(project: key, count: e.count, onTime: e.onTime, late: e.late)
            }
            .sorted { $0.count > $1.count }

        // Daily trend
        var days: [Date] = []
        var cursor = rangeStart
        let lastDay = DayMath.startOfDay(rangeEnd, calendar: calendar)
        while cursor <= lastDay {
            days.append(cursor)
            cursor = DayMath.adding(days: 1, to: cursor, calendar: calendar)
        }
        let dailyTrend: [TrendPoint] = days.map { day in
            let c = calendar.dateComponents([.month, .day], from: day)
            let count = inRange.filter { t in t.completedAt.map { DayMath.isSameDay($0, day, calendar: calendar) } ?? false }.count
            return TrendPoint(label: "\(c.month ?? 0)/\(c.day ?? 0)", value: count)
        }

        // Weekly trend
        var weekMap: [String: Int] = [:]
        for t in inRange {
            guard let completed = t.completedAt else { continue }
            let key = DayMath.isoDateString(startOfWeek(completed, calendar: calendar), calendar: calendar)
            weekMap[key, default: 0] += 1
        }
        let weeklyTrend: [TrendPoint] = weekMap.keys.sorted().map { key in
            let c = calendar.dateComponents([.month, .day], from: DayMath.startOfDay(dateFromISO(key, calendar: calendar), calendar: calendar))
            return TrendPoint(label: "\(c.month ?? 0)/\(c.day ?? 0)", value: weekMap[key] ?? 0)
        }

        // Monthly trend
        var monthMap: [String: Int] = [:]
        for t in inRange {
            guard let completed = t.completedAt else { continue }
            let c = calendar.dateComponents([.year, .month], from: completed)
            let key = String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
            monthMap[key, default: 0] += 1
        }
        let monthlyTrend: [TrendPoint] = monthMap.keys.sorted().map { key in
            let m = Int(key.split(separator: "-")[1]) ?? 1
            return TrendPoint(label: monthNames[max(0, min(11, m - 1))], value: monthMap[key] ?? 0)
        }

        // Streaks: consecutive calendar days with at least one completion, across ALL done (not just in range)
        let today = DayMath.startOfDay(now, calendar: calendar)
        var completionDays = Set<String>()
        for t in done {
            if let c = t.completedAt { completionDays.insert(DayMath.isoDateString(c, calendar: calendar)) }
        }

        var streakDay = today
        if !completionDays.contains(DayMath.isoDateString(streakDay, calendar: calendar)) {
            streakDay = DayMath.adding(days: -1, to: streakDay, calendar: calendar)
        }
        var currentStreak = 0
        while completionDays.contains(DayMath.isoDateString(streakDay, calendar: calendar)) {
            currentStreak += 1
            streakDay = DayMath.adding(days: -1, to: streakDay, calendar: calendar)
        }

        let sortedDays = completionDays.sorted()
        var bestStreak = 0
        var tempStreak = sortedDays.isEmpty ? 0 : 1
        for i in 1..<max(1, sortedDays.count) where sortedDays.count > 1 {
            let prev = dateFromISO(sortedDays[i - 1], calendar: calendar)
            let curr = dateFromISO(sortedDays[i], calendar: calendar)
            if DayMath.daysBetween(prev, curr, calendar: calendar) == 1 {
                tempStreak += 1
            } else {
                bestStreak = max(bestStreak, tempStreak)
                tempStreak = 1
            }
        }
        bestStreak = max(bestStreak, tempStreak, currentStreak)
        if sortedDays.isEmpty { bestStreak = 0 }

        let avgPerDay = Double(totalCompleted) / Double(max(1, days.count))

        // Most productive day of week
        var dayOfWeekCounts = [Int](repeating: 0, count: 7)
        for t in inRange {
            if let c = t.completedAt { dayOfWeekCounts[DayMath.weekday(c, calendar: calendar)] += 1 }
        }
        let maxDayCount = dayOfWeekCounts.max() ?? 0
        let mostProductiveDay: String? = maxDayCount > 0
            ? fullDayNames[dayOfWeekCounts.firstIndex(of: maxDayCount) ?? 0]
            : nil

        let topProject = byProject.first?.project

        let calibration = Calibration.computeCalibration(inRange)

        return InsightsData(
            totalCompleted: totalCompleted,
            completedOnTime: completedOnTime,
            completedLate: completedLate,
            completedNoDueDate: completedNoDueDate,
            byProject: byProject,
            dailyTrend: dailyTrend,
            weeklyTrend: weeklyTrend,
            monthlyTrend: monthlyTrend,
            currentStreak: currentStreak,
            bestStreak: bestStreak,
            avgPerDay: avgPerDay,
            mostProductiveDay: mostProductiveDay,
            topProject: topProject,
            calibration: calibration
        )
    }

    private static func dateFromISO(_ isoDate: String, calendar: Calendar) -> Date {
        let parts = isoDate.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return Date() }
        var c = DateComponents()
        c.year = parts[0]; c.month = parts[1]; c.day = parts[2]
        return calendar.date(from: c) ?? Date()
    }
}
