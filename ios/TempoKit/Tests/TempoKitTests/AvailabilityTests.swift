import Foundation
import Testing
@testable import TempoKit

/// Port of scratchpad/verify-availability.ts (fixture day: 2026-09-13, America/Los_Angeles).
@Suite struct AvailabilityTests {
    let cal = LA.calendar
    let dayStart = "09:00", dayEnd = "17:00"

    func ev(_ sh: Int, _ sm: Int, _ eh: Int, _ em: Int, allDay: Bool = false) -> TimeBlock {
        TimeBlock(startTime: LA.at(sh, sm), endTime: LA.at(eh, em), allDay: allDay)
    }

    func avail(now: Date, events: [TimeBlock] = [], start: String? = nil, end: String? = nil) -> DayAvailability {
        Availability.computeAvailability(now: now, dayStart: start ?? dayStart, dayEnd: end ?? dayEnd, events: events, calendar: cal)
    }

    @Test func clockOnDay() {
        #expect(cal.component(.hour, from: Availability.clockOnDay(LA.at(12), "09:00", calendar: cal)!) == 9)
        #expect(Availability.clockOnDay(LA.at(12), "nine", calendar: cal) == nil)
        #expect(Availability.clockOnDay(LA.at(12), "25:00", calendar: cal) == nil)
        #expect(Availability.clockOnDay(LA.at(12), "9:30", calendar: cal) == LA.at(9, 30))
        #expect(Availability.clockOnDay(LA.at(12), "09:5", calendar: cal) == nil)
    }

    @Test func window() {
        var a = avail(now: LA.at(7, 30))
        #expect(a.windowMinutes == 480)
        #expect(a.freeMinutes == 480)
        a = avail(now: LA.at(13))
        #expect(a.windowMinutes == 240)
        a = avail(now: LA.at(18))
        #expect(a.windowMinutes == 0)
        #expect(a.freeMinutes == 0)
        #expect(avail(now: LA.at(13), start: "x", end: "").windowMinutes == 240)
    }

    @Test func busyMerging() {
        var a = avail(now: LA.at(13), events: [ev(14, 0, 15, 0), ev(14, 30, 16, 0)])
        #expect(a.busyMinutes == 120)
        #expect(a.freeMinutes == 120)
        a = avail(now: LA.at(13), events: [ev(14, 0, 15, 0), ev(14, 30, 16, 0), ev(9, 0, 17, 0, allDay: true)])
        #expect(a.busyMinutes == 120)
        a = avail(now: LA.at(13), events: [ev(16, 30, 18, 0)])
        #expect(a.busyMinutes == 30)
        a = avail(now: LA.at(13), events: [ev(11, 0, 13, 30)])
        #expect(a.busyMinutes == 30)
        a = avail(now: LA.at(13), events: [ev(8, 0, 9, 0)])
        #expect(a.busyMinutes == 0)
        a = avail(now: LA.at(13), events: [ev(9, 0, 17, 0)])
        #expect(a.freeMinutes == 0)
    }

    @Test func messages() {
        let a = avail(now: LA.at(13)) // 240 free
        #expect(Availability.overcommitMinutes(a, plannedMinutes: 240) == 0)
        #expect(Availability.overcommitMessage(a, plannedMinutes: 240, calendar: cal) == nil)
        #expect(Availability.overcommitMessage(a, plannedMinutes: 270, calendar: cal) == nil)
        #expect(Availability.overcommitMessage(a, plannedMinutes: 271, calendar: cal)
            == "About 4h 31m planned, and roughly 4h free before 5:00 PM. Want to move something to tomorrow?")
        #expect(Availability.overcommitMessage(avail(now: LA.at(18)), plannedMinutes: 300, calendar: cal) == nil)
        #expect(Availability.overcommitMessage(avail(now: LA.at(13), events: [ev(9, 0, 17, 0)]), plannedMinutes: 60, calendar: cal)
            == "About 1h planned, and no time free before 5:00 PM. Want to move something to tomorrow?")
        #expect(Availability.overcommitMessage(avail(now: LA.at(13, 2)), plannedMinutes: 300, calendar: cal)
            == "About 5h planned, and roughly 4h free before 5:00 PM. Want to move something to tomorrow?")
    }

    @Test func todayOvercommit() {
        let a = UUID()
        let todos: [Todo] = [
            .fixture("a", id: a, estimatedMinutes: 90),
            .fixture("b", size: .large),
            .fixture("c", size: .medium),
        ] // 180
        let now = LA.at(13)
        #expect(Availability.todayOvercommitMessage(todos: todos, timer: nil, events: [TimeBlock](), dayStart: dayStart, dayEnd: dayEnd, now: now, calendar: cal) == nil)

        let yesterday = LA.day(2026, 9, 12)
        let events = [ev(13, 0, 17, 0), TimeBlock(startTime: LA.at(13, 0, on: yesterday), endTime: LA.at(17, 0, on: yesterday))]
        #expect(Availability.todayOvercommitMessage(todos: todos, timer: nil, events: events, dayStart: dayStart, dayEnd: dayEnd, now: now, calendar: cal)
            == "About 3h planned, and no time free before 5:00 PM. Want to move something to tomorrow?")

        let timer = TimerSnapshot(activeTaskId: a, elapsedSeconds: 60 * 60)
        #expect(Availability.todayOvercommitMessage(todos: todos, timer: timer, events: [ev(13, 0, 15, 0)], dayStart: dayStart, dayEnd: dayEnd, now: now, calendar: cal) == nil)

        #expect(Availability.todayOvercommitMessage(todos: [Todo](), timer: nil, events: [ev(9, 0, 17, 0)], dayStart: dayStart, dayEnd: dayEnd, now: now, calendar: cal) == nil)
    }
}
