import Foundation
import Testing
@testable import TempoKit

/// Port of scratchpad/verify-time.ts plus the minutesToRecord cases from verify-calibration.ts.
@Suite struct TimeMathTests {
    let a = UUID(), b = UUID(), c = UUID(), d = UUID()
    var todos: [Todo] {
        [
            .fixture("Clean kitchen", id: a, estimatedMinutes: 30),
            .fixture("Write brief", id: b, size: .large),   // 60 default
            .fixture("Reply to Sam", id: c, size: .small),  // 15 default
            .fixture("Untyped", id: d),                     // 25 default
        ]
    }
    let now = LA.at(14, 0, on: LA.day(2026, 9, 11))

    @Test func estimates() {
        #expect(TimeMath.getEstimate(todos[0]) == 30)
        #expect(TimeMath.getEstimate(todos[1]) == 60)
        #expect(TimeMath.getEstimate(todos[3]) == 25)
        #expect(TimeMath.defaultEstimate(.medium) == 30)
        #expect(TimeMath.totalEstimatedMinutes(todos) == 130)
    }

    @Test func noTimer() {
        #expect(TimeMath.remainingMinutes(todos, timer: nil) == 130)
        #expect(TimeMath.formatClock(TimeMath.projectedEndTime(todos, timer: nil, now: now), calendar: LA.calendar) == "4:10 PM")
    }

    @Test func runningTimer() {
        let tenIn = TimerSnapshot(activeTaskId: a, elapsedSeconds: 600)
        #expect(TimeMath.remainingMinutes(todos, timer: tenIn) == 120)
        #expect(TimeMath.formatClock(TimeMath.projectedEndTime(todos, timer: tenIn, now: now), calendar: LA.calendar) == "4:00 PM")
        // 50m over on a (30m est): a contributes 0, others intact
        #expect(TimeMath.remainingMinutes(todos, timer: TimerSnapshot(activeTaskId: a, elapsedSeconds: 80 * 60)) == 100)
        // ceil to whole minute
        #expect(TimeMath.remainingMinutes(todos, timer: TimerSnapshot(activeTaskId: a, elapsedSeconds: 20)) == 130)
        #expect(TimeMath.remainingMinutes(todos, timer: TimerSnapshot(activeTaskId: a, elapsedSeconds: 61)) == 129)
        // active id not in list: ignored
        #expect(TimeMath.remainingMinutes(todos, timer: TimerSnapshot(activeTaskId: UUID(), elapsedSeconds: 999)) == 130)
    }

    @Test func overEstimateFloorsAtZero() {
        let over = TimerSnapshot(activeTaskId: a, elapsedSeconds: 3600)
        #expect(TimeMath.remainingSeconds([todos[0]], timer: over) == 0)
        #expect(TimeMath.remainingMinutes([todos[0]], timer: over) == 0)
        #expect(TimeMath.projectedEndTime([todos[0]], timer: over, now: now) == now)
        #expect(TimeMath.remainingMinutes([Todo](), timer: nil) == 0)
    }

    @Test func minutesToRecord() {
        #expect(TimeMath.minutesToRecord(elapsedSeconds: 10) == 0)
        #expect(TimeMath.minutesToRecord(elapsedSeconds: 30) == 1)
        #expect(TimeMath.minutesToRecord(elapsedSeconds: 89) == 1)
        #expect(TimeMath.minutesToRecord(elapsedSeconds: 90) == 2)
        #expect(TimeMath.minutesToRecord(elapsedSeconds: 7200) == 120)
    }

    @Test func formatting() {
        #expect(TimeMath.formatMinutes(130) == "2h 10m")
        #expect(TimeMath.formatMinutes(60) == "1h")
        #expect(TimeMath.formatMinutes(25) == "25m")
        #expect(TimeMath.formatElapsed(3725) == "1:02:05")
        #expect(TimeMath.formatElapsed(65) == "1:05")
        #expect(TimeMath.formatClock(LA.at(0, 5), calendar: LA.calendar) == "12:05 AM")
        #expect(TimeMath.formatClock(LA.at(12, 0), calendar: LA.calendar) == "12:00 PM")
    }
}
