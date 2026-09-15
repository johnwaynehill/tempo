import Foundation

/// Port of `src/hooks/useTimer.ts`: the persisted shape of the task timer.
///
/// Elapsed time is derived from wall-clock timestamps rather than counted by a
/// ticking clock, so a suspended app can't lose seconds and a relaunch picks up
/// where it left off. Every transition takes `now` explicitly so the arithmetic is
/// testable with fixed dates; callers default to `Date()`.
///
/// The struct is a value: `starting`, `paused`, `resumed`, and `stopped` return the
/// next state instead of mutating, which keeps it trivially `Sendable` and lets a
/// view model persist each transition (mirroring `saveState` on the web).
public struct TimerState: Codable, Hashable, Sendable {
    public var activeTaskId: UUID?
    /// First start of this run; decides which calendar day it belongs to.
    public var startedAt: Date?
    /// Seconds banked before the current run segment (i.e. across pauses).
    public var accumulatedSeconds: Int
    /// When the current run segment started; nil while paused or idle.
    public var runningSince: Date?

    public init(activeTaskId: UUID? = nil, startedAt: Date? = nil, accumulatedSeconds: Int = 0, runningSince: Date? = nil) {
        self.activeTaskId = activeTaskId
        self.startedAt = startedAt
        self.accumulatedSeconds = accumulatedSeconds
        self.runningSince = runningSince
    }

    public static let idle = TimerState()

    /// Running or paused — there is a task on the clock.
    public var isActive: Bool { activeTaskId != nil }
    public var isRunning: Bool { isActive && runningSince != nil }
    public var isPaused: Bool { isActive && runningSince == nil }

    /// Banked seconds plus the current segment. The segment is floored at 0 so a
    /// clock that jumped backwards (NTP correction, time zone change) can't go negative.
    public func elapsedSeconds(at now: Date = Date()) -> Int {
        guard let runningSince else { return accumulatedSeconds }
        let running = Int(now.timeIntervalSince(runningSince).rounded(.down))
        return accumulatedSeconds + max(0, running)
    }

    /// True when the run's first start was on a different calendar day than `now`.
    /// Nobody works a 23-hour task; a timer left running overnight is discarded on
    /// load and on the next tick rather than being recorded.
    public func isStale(at now: Date = Date(), calendar: Calendar = .current) -> Bool {
        guard isActive, let startedAt else { return false }
        return !DayMath.isSameDay(startedAt, now, calendar: calendar)
    }

    /// Starts a fresh run for `id`, discarding whatever was on the clock (this is
    /// also `reset` on the web).
    public func starting(_ id: UUID, at now: Date = Date()) -> TimerState {
        TimerState(activeTaskId: id, startedAt: now, accumulatedSeconds: 0, runningSince: now)
    }

    /// Banks the current segment. No-op unless running.
    public func paused(at now: Date = Date()) -> TimerState {
        guard isRunning else { return self }
        var next = self
        next.accumulatedSeconds = elapsedSeconds(at: now)
        next.runningSince = nil
        return next
    }

    /// Opens a new segment. No-op unless paused.
    public func resumed(at now: Date = Date()) -> TimerState {
        guard isPaused else { return self }
        var next = self
        next.runningSince = now
        return next
    }

    /// Returns the idle state plus how many seconds the run lasted (0 when idle).
    public func stopped(at now: Date = Date()) -> (state: TimerState, elapsedSeconds: Int) {
        (.idle, isActive ? elapsedSeconds(at: now) : 0)
    }

    /// What `TimeMath` needs for projections; nil when idle.
    public func snapshot(at now: Date = Date()) -> TimerSnapshot? {
        guard let activeTaskId else { return nil }
        return TimerSnapshot(activeTaskId: activeTaskId, elapsedSeconds: elapsedSeconds(at: now))
    }
}

/// Port of `src/hooks/useTaskTimer.ts`: the bookkeeping that turns a timer run into
/// `startedAt` and `actualMinutes` on the todo. Pure functions; the caller sends the
/// resulting patches through the client or the write queue.
public enum TaskTimer {
    /// Stops `state` and works out what the run adds to the todo. `minutesThisRun` is
    /// 0 when the run was too short to count (see `TimeMath.minRunSeconds`);
    /// `actualMinutes` is the todo's total after adding it.
    public static func stopResult(
        state: TimerState, priorActualMinutes: Int?, at now: Date = Date()
    ) -> (state: TimerState, minutesThisRun: Int, actualMinutes: Int) {
        let (next, elapsed) = state.stopped(at: now)
        let minutes = TimeMath.minutesToRecord(elapsedSeconds: elapsed)
        return (next, minutes, (priorActualMinutes ?? 0) + minutes)
    }

    /// The write to make when a timer starts on `todo`: stamps `startedAt` the first
    /// time only, so calibration measures from the first attempt. Nil when nothing
    /// needs saving.
    public static func startPatch(for todo: Todo, at now: Date = Date()) -> TodoPatch? {
        todo.startedAt == nil ? TodoPatch(startedAt: .set(now)) : nil
    }

    /// The write to make after a stop that isn't a completion (completion sends the
    /// minutes through `completeTodo` instead). Nil when the run didn't count.
    public static func stopPatch(minutesThisRun: Int, actualMinutes: Int) -> TodoPatch? {
        minutesThisRun > 0 ? TodoPatch(actualMinutes: .set(actualMinutes)) : nil
    }
}
