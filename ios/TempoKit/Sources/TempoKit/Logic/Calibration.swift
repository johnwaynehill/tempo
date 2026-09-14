import Foundation

/// A completed todo that may carry timed minutes (mirrors `TimedTodo` in `src/lib/calibration.ts`).
public protocol Calibratable: Estimable {
    var actualMinutes: Int? { get }
    var project: String? { get }
    var completedAt: Date? { get }
}

public struct CalibrationGroup: Hashable, Sendable {
    public var key: String
    public var count: Int
    public var estimatedMinutes: Int
    public var actualMinutes: Int
    /// actual / estimated
    public var ratio: Double

    public init(key: String, count: Int, estimatedMinutes: Int, actualMinutes: Int, ratio: Double) {
        self.key = key
        self.count = count
        self.estimatedMinutes = estimatedMinutes
        self.actualMinutes = actualMinutes
        self.ratio = ratio
    }
}

public struct CalibrationSummary: Hashable, Sendable {
    public var timedCount: Int
    public var estimatedMinutes: Int
    public var actualMinutes: Int
    /// actual / estimated across all timed todos; nil below `Calibration.MIN_TIMED`.
    public var ratio: Double?
    public var bySize: [CalibrationGroup]
    /// Sorted by count, most-timed project first.
    public var byProject: [CalibrationGroup]
}

/// Port of `src/lib/calibration.ts`: how timed completions compared to their estimates.
public enum Calibration {
    /// Below this many timed completions there is nothing trustworthy to say.
    public static let MIN_TIMED = 3

    public static let SIZE_LABEL: [String: String] = [
        "small": "Small", "medium": "Medium", "large": "Large", "unsized": "Unsized",
    ]

    private static let sizeOrder = ["small", "medium", "large", "unsized"]

    public static func isTimed(_ todo: some Calibratable) -> Bool {
        if let m = todo.actualMinutes { return m > 0 }
        return false
    }

    private static func groupBy<T: Calibratable>(_ todos: [T], keyOf: (T) -> String) -> [CalibrationGroup] {
        var order: [String] = []
        var map: [String: (count: Int, estimated: Int, actual: Int)] = [:]
        for t in todos {
            let key = keyOf(t)
            var g = map[key] ?? (0, 0, 0)
            if map[key] == nil { order.append(key) }
            g.count += 1
            g.estimated += TimeMath.getEstimate(t)
            g.actual += t.actualMinutes ?? 0
            map[key] = g
        }
        return order.map { key in
            let g = map[key]!
            return CalibrationGroup(
                key: key, count: g.count, estimatedMinutes: g.estimated, actualMinutes: g.actual,
                ratio: Double(g.actual) / Double(g.estimated)
            )
        }
    }

    public static func computeCalibration(_ todos: [some Calibratable]) -> CalibrationSummary {
        let timed = todos.filter { isTimed($0) }
        let estimatedMinutes = timed.reduce(0) { $0 + TimeMath.getEstimate($1) }
        let actualMinutes = timed.reduce(0) { $0 + ($1.actualMinutes ?? 0) }

        let bySize = groupBy(timed) { $0.size?.rawValue ?? "unsized" }
            .sorted { (sizeOrder.firstIndex(of: $0.key) ?? -1) < (sizeOrder.firstIndex(of: $1.key) ?? -1) }
        let byProject = groupBy(timed) { ($0.project?.isEmpty == false ? $0.project! : "Ungrouped") }
            .sorted { $0.count > $1.count }

        return CalibrationSummary(
            timedCount: timed.count,
            estimatedMinutes: estimatedMinutes,
            actualMinutes: actualMinutes,
            ratio: timed.count >= MIN_TIMED && estimatedMinutes > 0 ? Double(actualMinutes) / Double(estimatedMinutes) : nil,
            bySize: bySize,
            byProject: byProject
        )
    }

    /// One neutral sentence about the overall ratio, or nil when there isn't enough data.
    public static func calibrationHeadline(_ c: CalibrationSummary) -> String? {
        guard let ratio = c.ratio else { return nil }
        if ratio >= 0.85 && ratio <= 1.15 { return "Your estimates were close this week." }
        let pct = TimeMath.jsRound(abs(ratio - 1) * 100)
        return ratio > 1
            ? "Tasks ran about \(pct)% longer than you guessed."
            : "Tasks finished about \(pct)% faster than you guessed."
    }

    /// The first group (size first, then project) that ran at least 1.3× over with
    /// enough completions to mean something. Nil when nothing stands out.
    public static func calibrationPattern(_ c: CalibrationSummary) -> String? {
        let over: (CalibrationGroup) -> Bool = { $0.count >= MIN_TIMED && $0.ratio >= 1.3 }
        if let size = c.bySize.first(where: over) {
            return "\(SIZE_LABEL[size.key] ?? size.key) tasks tend to take about \(toFixed1(size.ratio))× your estimate."
        }
        if let project = c.byProject.first(where: over) {
            return "\(project.key) tasks tend to take about \(toFixed1(project.ratio))× your estimate."
        }
        return nil
    }

    /// Typical actual minutes for a size over the last `windowDays` of timed completions,
    /// rounded to the nearest 5. Nil below `MIN_TIMED`.
    public static func typicalMinutesForSize(
        _ todos: [some Calibratable], size: TodoSize, windowDays: Int = 28, now: Date = Date()
    ) -> Int? {
        let since = now.addingTimeInterval(-Double(windowDays) * 86_400)
        let sample = todos.filter { t in
            guard isTimed(t), t.size == size, let completed = t.completedAt else { return false }
            return completed >= since
        }
        if sample.count < MIN_TIMED { return nil }
        let mean = Double(sample.reduce(0) { $0 + ($1.actualMinutes ?? 0) }) / Double(sample.count)
        return max(5, TimeMath.jsRound(mean / 5) * 5)
    }

    /// JavaScript `Number.toFixed(1)` (ties round up).
    static func toFixed1(_ x: Double) -> String {
        let n = (x * 10 + 0.5).rounded(.down)
        return String(format: "%.1f", n / 10)
    }
}
