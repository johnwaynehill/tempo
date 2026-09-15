import Foundation
import Testing
@testable import TempoKit

/// Port of the useTimer/useTaskTimer behaviour with fixed dates.
@Suite struct TimerStateTests {
    let task = UUID()
    let t0 = LA.at(9, 0, on: LA.day(2026, 9, 14))

    func sec(_ n: Int) -> Date { t0.addingTimeInterval(TimeInterval(n)) }

    @Test func idle() {
        let idle = TimerState.idle
        #expect(!idle.isActive)
        #expect(!idle.isRunning)
        #expect(!idle.isPaused)
        #expect(idle.elapsedSeconds(at: t0) == 0)
        #expect(idle.snapshot(at: t0) == nil)
        #expect(idle.stopped(at: t0).elapsedSeconds == 0)
        #expect(idle.paused(at: t0) == idle)
        #expect(idle.resumed(at: t0) == idle)
        #expect(!idle.isStale(at: t0, calendar: LA.calendar))
    }

    @Test func startPauseResumeStop() {
        let running = TimerState.idle.starting(task, at: t0)
        #expect(running.isRunning)
        #expect(!running.isPaused)
        #expect(running.startedAt == t0)
        #expect(running.elapsedSeconds(at: sec(90)) == 90)
        #expect(running.snapshot(at: sec(90)) == TimerSnapshot(activeTaskId: task, elapsedSeconds: 90))

        let paused = running.paused(at: sec(90))
        #expect(paused.isPaused)
        #expect(paused.accumulatedSeconds == 90)
        #expect(paused.runningSince == nil)
        #expect(paused.elapsedSeconds(at: sec(500)) == 90, "a paused clock doesn't advance")
        #expect(paused.paused(at: sec(500)) == paused)
        #expect(paused.startedAt == t0, "first start survives pauses")

        let resumed = paused.resumed(at: sec(500))
        #expect(resumed.isRunning)
        #expect(resumed.elapsedSeconds(at: sec(530)) == 120)
        #expect(resumed.resumed(at: sec(600)) == resumed)

        let (stopped, elapsed) = resumed.stopped(at: sec(530))
        #expect(stopped == .idle)
        #expect(elapsed == 120)
    }

    @Test func startingAgainResets() {
        let other = UUID()
        let second = TimerState.idle.starting(task, at: t0).paused(at: sec(300)).starting(other, at: sec(400))
        #expect(second.activeTaskId == other)
        #expect(second.accumulatedSeconds == 0)
        #expect(second.startedAt == sec(400))
        #expect(second.elapsedSeconds(at: sec(410)) == 10)
    }

    @Test func clockGoingBackwardsFloorsAtZero() {
        let running = TimerState.idle.starting(task, at: t0).paused(at: sec(60)).resumed(at: sec(100))
        #expect(running.elapsedSeconds(at: sec(50)) == 60)
        // Fractional seconds are floored, like Math.floor on the web.
        #expect(running.elapsedSeconds(at: sec(100).addingTimeInterval(1.9)) == 61)
    }

    @Test func staleAcrossMidnight() {
        let lateStart = LA.at(23, 50, on: LA.day(2026, 9, 13))
        let running = TimerState.idle.starting(task, at: lateStart)
        #expect(!running.isStale(at: LA.at(23, 59, on: LA.day(2026, 9, 13)), calendar: LA.calendar))
        #expect(running.isStale(at: LA.at(0, 10, on: LA.day(2026, 9, 14)), calendar: LA.calendar))
        #expect(running.paused(at: lateStart.addingTimeInterval(60)).isStale(at: LA.at(8, 0, on: LA.day(2026, 9, 14)), calendar: LA.calendar))
        // Staleness is a calendar-day question, so the zone matters: 23:50 and 00:10 in
        // LA are 06:50 and 07:10 UTC on the same day.
        let utc = DayMath.calendar(timeZone: TimeZone(identifier: "UTC")!)
        #expect(!running.isStale(at: LA.at(0, 10, on: LA.day(2026, 9, 14)), calendar: utc))
    }

    @Test func jsonRoundTrip() throws {
        let state = TimerState.idle.starting(task, at: t0).paused(at: sec(90)).resumed(at: sec(500))
        let data = try TempoJSON.encoder.encode(state)
        let back = try TempoJSON.decoder.decode(TimerState.self, from: data)
        #expect(back == state)
        #expect(back.elapsedSeconds(at: sec(530)) == 120)

        let obj = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(obj["accumulatedSeconds"] as? Int == 90)
        #expect(obj["startedAt"] as? String == "2026-09-14T16:00:00.000Z")

        let idleBack = try TempoJSON.decoder.decode(TimerState.self, from: try TempoJSON.encoder.encode(TimerState.idle))
        #expect(idleBack == .idle)
    }

    @Test func taskTimerStopResult() {
        let running = TimerState.idle.starting(task, at: t0)

        let short = TaskTimer.stopResult(state: running, priorActualMinutes: 12, at: sec(20))
        #expect(short.state == .idle)
        #expect(short.minutesThisRun == 0)
        #expect(short.actualMinutes == 12)
        #expect(TaskTimer.stopPatch(minutesThisRun: short.minutesThisRun, actualMinutes: short.actualMinutes) == nil)

        let long = TaskTimer.stopResult(state: running, priorActualMinutes: 12, at: sec(7 * 60 + 20))
        #expect(long.minutesThisRun == 7)
        #expect(long.actualMinutes == 19)
        #expect(TaskTimer.stopPatch(minutesThisRun: 7, actualMinutes: 19)?.actualMinutes == .set(19))

        let first = TaskTimer.stopResult(state: running, priorActualMinutes: nil, at: sec(45))
        #expect(first.minutesThisRun == 1)
        #expect(first.actualMinutes == 1)
    }

    @Test func taskTimerStartPatch() {
        let fresh = Todo.fixture("New")
        let patch = TaskTimer.startPatch(for: fresh, at: t0)
        #expect(patch?.startedAt == .set(t0))
        #expect(patch?.actualMinutes == nil)

        var attempted = fresh
        attempted.startedAt = sec(-3600)
        #expect(TaskTimer.startPatch(for: attempted, at: t0) == nil, "startedAt is the first attempt, never overwritten")
    }
}
