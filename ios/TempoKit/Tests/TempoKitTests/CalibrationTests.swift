import Foundation
import Testing
@testable import TempoKit

/// Port of scratchpad/verify-calibration.ts.
@Suite struct CalibrationTests {
    let untimed = Todo.fixture("untimed", size: .small, estimatedMinutes: 15, completedAt: daysAgo(1))
    let zero = Todo.fixture("zero", size: .small, estimatedMinutes: 15, actualMinutes: 0, completedAt: daysAgo(1))

    var week: [Todo] {
        [
            .fixture("1", project: "Home", size: .small, estimatedMinutes: 15, actualMinutes: 15, completedAt: daysAgo(1)),
            .fixture("2", project: "Writing", size: .medium, actualMinutes: 45, completedAt: daysAgo(2)), // default est 30
            .fixture("3", project: "Writing", size: .medium, estimatedMinutes: 30, actualMinutes: 48, completedAt: daysAgo(3)),
            .fixture("4", project: "Writing", size: .medium, estimatedMinutes: 30, actualMinutes: 42, completedAt: daysAgo(4)),
            .fixture("5", project: "Home", size: .large, estimatedMinutes: 60, actualMinutes: 60, completedAt: daysAgo(5)),
            untimed, zero,
        ]
    }

    @Test func isTimed() {
        #expect(Calibration.isTimed(untimed) == false)
        #expect(Calibration.isTimed(zero) == false)
        #expect(Calibration.isTimed(week[0]) == true)
    }

    @Test func belowThreshold() {
        let c = Calibration.computeCalibration([
            Todo.fixture("a", size: .small, estimatedMinutes: 15, actualMinutes: 20, completedAt: daysAgo(1)),
            Todo.fixture("b", size: .small, estimatedMinutes: 15, actualMinutes: 20, completedAt: daysAgo(1)),
            untimed,
        ])
        #expect(c.ratio == nil)
        #expect(c.timedCount == 2)
        #expect(Calibration.calibrationHeadline(c) == nil)
    }

    @Test func weekSummary() throws {
        let c = Calibration.computeCalibration(week)
        #expect(c.timedCount == 5)
        #expect(c.estimatedMinutes == 165)
        #expect(c.actualMinutes == 210)
        let ratio = try #require(c.ratio)
        #expect((ratio * 1000).rounded() / 1000 == 1.273)
        #expect(c.bySize.map(\.key) == ["small", "medium", "large"])
        #expect(c.bySize[1] == CalibrationGroup(key: "medium", count: 3, estimatedMinutes: 90, actualMinutes: 135, ratio: 1.5))
        #expect(c.byProject.map { [$0.key, String($0.count)] } == [["Writing", "3"], ["Home", "2"]])
        #expect(Calibration.calibrationHeadline(c) == "Tasks ran about 27% longer than you guessed.")
        #expect(Calibration.calibrationPattern(c) == "Medium tasks tend to take about 1.5× your estimate.")
    }

    @Test func headlines() {
        let close = Calibration.computeCalibration((1...3).map { Todo.fixture("c\($0)", size: .small, estimatedMinutes: 20, actualMinutes: 21, completedAt: daysAgo(Double($0))) })
        #expect(Calibration.calibrationHeadline(close) == "Your estimates were close this week.")
        #expect(Calibration.calibrationPattern(close) == nil)
        let fast = Calibration.computeCalibration((1...3).map { Todo.fixture("f\($0)", size: .small, estimatedMinutes: 20, actualMinutes: 10, completedAt: daysAgo(Double($0))) })
        #expect(Calibration.calibrationHeadline(fast) == "Tasks finished about 50% faster than you guessed.")
    }

    @Test func patternFallsThroughToProject() {
        let projOnly = Calibration.computeCalibration([
            Todo.fixture("a", project: "Admin", size: .small, estimatedMinutes: 10, actualMinutes: 20, completedAt: daysAgo(1)),
            Todo.fixture("b", project: "Admin", size: .medium, estimatedMinutes: 30, actualMinutes: 45, completedAt: daysAgo(1)),
            Todo.fixture("c", project: "Admin", size: .large, estimatedMinutes: 60, actualMinutes: 85, completedAt: daysAgo(1)),
        ])
        #expect(Calibration.calibrationPattern(projOnly) == "Admin tasks tend to take about 1.5× your estimate.")
    }

    @Test func typicalMinutes() {
        #expect(Calibration.typicalMinutesForSize(week, size: .medium, now: fixedNow) == 45)
        #expect(Calibration.typicalMinutesForSize(week, size: .small, now: fixedNow) == nil)
        let old = week.map { var t = $0; t.completedAt = daysAgo(40); return t }
        #expect(Calibration.typicalMinutesForSize(old, size: .medium, now: fixedNow) == nil)
        let large = [43, 47, 48].map { (n: Int) in Todo.fixture("l\(n)", size: .large, actualMinutes: n, completedAt: daysAgo(1)) }
        #expect(Calibration.typicalMinutesForSize(large, size: .large, now: fixedNow) == 45)
    }

    @Test func unsizedAndUngrouped() {
        let c = Calibration.computeCalibration((1...3).map { Todo.fixture("u\($0)", estimatedMinutes: 10, actualMinutes: 20, completedAt: daysAgo(1)) })
        #expect(c.bySize.map(\.key) == ["unsized"])
        #expect(c.byProject.map(\.key) == ["Ungrouped"])
        #expect(Calibration.calibrationPattern(c) == "Unsized tasks tend to take about 2.0× your estimate.")
    }
}
