import SwiftUI
import TempoKit
import WidgetKit

/// Home Screen widget: today's habits, each with its own tap-to-toggle circle. Reads the app's
/// cached snapshot (`HabitsWidgetData`); the app reloads the timeline whenever it changes, and
/// the timeline also refreshes itself every 30 minutes (habits move far less than Today's clock).
struct HabitsWidget: Widget {
    static let kind = "TempoHabits"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: HabitsWidgetProvider()) { entry in
            HabitsWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Habits")
        .description("Today's habits, one tap to check off.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct HabitsWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> HabitsWidgetEntry {
        .placeholder()
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (HabitsWidgetEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder())
            return
        }
        Task {
            completion(await HabitsWidgetData.entry())
        }
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<HabitsWidgetEntry>) -> Void) {
        Task {
            let now = Date()
            let entry = await HabitsWidgetData.entry(now: now)
            completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(30 * 60))))
        }
    }
}

private struct HabitsWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: HabitsWidgetEntry

    var body: some View {
        HabitsWidgetView(entry: entry, family: family) { habitId, completedToday in
            ToggleHabitWidgetButton(habitId: habitId, date: DayMath.isoDateString(entry.date), completedToday: completedToday)
        }
        .containerBackground(WidgetTheme.surfaceContainerLowest, for: .widget)
    }
}
