import Foundation
import TempoKit
import WidgetKit

/// What the Habits widget and its toggle intent know about today's habits, read without the
/// app running: the cached snapshot (`TodayWidgetData.snapshot`) plus a short-lived override
/// layer for instant feedback on a tap. Nothing here talks to the network.
enum HabitsWidgetData {
    /// An override is trusted for this long; past it the cached snapshot is assumed to have
    /// caught up (the app flushes and refreshes on every launch and foreground), so a stuck
    /// override — the write was rejected, or never reached the server at all — can't wedge
    /// the widget in the wrong state forever.
    private static let overrideTTL: TimeInterval = 10 * 60

    private struct Override: Codable {
        var completed: Bool
        var at: Date
    }

    /// Records a tap's intent immediately, before the real write (network or `PendingOpInbox`)
    /// even starts, so the widget's post-tap reload shows the new state right away.
    static func setOverride(habitId: UUID, date: String, completed: Bool, now: Date = Date()) {
        var overrides = readOverrides()
        overrides["\(habitId.uuidString)|\(date)"] = Override(completed: completed, at: now)
        guard let data = try? JSONEncoder().encode(overrides) else { return }
        AppGroup.defaults.set(data, forKey: AppGroup.habitOverridesKey)
    }

    private static func readOverrides() -> [String: Override] {
        guard let data = AppGroup.defaults.data(forKey: AppGroup.habitOverridesKey),
              let decoded = try? JSONDecoder().decode([String: Override].self, from: data)
        else { return [:] }
        return decoded
    }

    /// Today's active habits from the cached snapshot, with any fresh override applied.
    static func entry(now: Date = Date(), calendar: Calendar = .current) async -> HabitsWidgetEntry {
        guard let key = TodayWidgetData.apiKey() else { return HabitsWidgetEntry(date: now, content: .signedOut) }
        guard let snapshot = await TodayWidgetData.snapshot(apiKey: key) else { return HabitsWidgetEntry(date: now, content: .notLoaded) }

        let today = DayMath.isoDateString(now, calendar: calendar)
        let overrides = readOverrides()
        let active = snapshot.habits
            .filter { !$0.archived }
            .map { habit -> HabitsWidgetHabit in
                let override = overrides["\(habit.id.uuidString)|\(today)"]
                let completedToday = (override != nil && now.timeIntervalSince(override!.at) < overrideTTL)
                    ? override!.completed
                    : habit.isCompleted(on: today)
                return HabitsWidgetHabit(id: habit.id, name: habit.name, completedToday: completedToday, streak: streak(habit, calendar: calendar))
            }
        guard !active.isEmpty else { return HabitsWidgetEntry(date: now, content: .empty) }
        return HabitsWidgetEntry(date: now, content: .habits(active))
    }

    private static func streak(_ habit: Habit, calendar: Calendar) -> Int {
        let completions = habit.completions.filter(\.value).compactMap { key, _ -> Date? in
            let parts = key.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 3 else { return nil }
            var c = DateComponents()
            c.year = parts[0]; c.month = parts[1]; c.day = parts[2]; c.hour = 12
            return calendar.date(from: c)
        }
        return Streaks.currentStreak(completions: completions, calendar: calendar).currentStreak
    }
}

struct HabitsWidgetHabit: Hashable, Sendable, Identifiable {
    var id: UUID
    var name: String
    var completedToday: Bool
    var streak: Int
}

struct HabitsWidgetEntry: TimelineEntry, Hashable, Sendable {
    enum Content: Hashable, Sendable {
        case signedOut
        case notLoaded
        /// Signed in and loaded, but every habit is archived (or there are none).
        case empty
        case habits([HabitsWidgetHabit])
    }

    var date: Date
    var content: Content

    static func placeholder(now: Date = Date()) -> HabitsWidgetEntry {
        HabitsWidgetEntry(date: now, content: .habits([
            HabitsWidgetHabit(id: UUID(), name: "Morning walk", completedToday: true, streak: 4),
            HabitsWidgetHabit(id: UUID(), name: "Read 10 pages", completedToday: false, streak: 0),
            HabitsWidgetHabit(id: UUID(), name: "Drink water", completedToday: false, streak: 12),
        ]))
    }
}
