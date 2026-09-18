import SwiftUI
import WidgetKit

/// Home Screen and Lock Screen widget: what's left on Today, or the task on the clock.
/// Reads the app's cached snapshot and shared timer (`TodayWidgetData`); the app reloads the
/// timeline whenever either changes, and the timeline refreshes itself every 15 minutes.
struct TodayWidget: Widget {
    static let kind = "TempoToday"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: TodayWidgetProvider()) { entry in
            TodayWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("What's left today, and the task on the clock.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

struct TodayWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayWidgetEntry {
        .placeholder()
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (TodayWidgetEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder())
            return
        }
        Task {
            completion(await TodayWidgetData.entry())
        }
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<TodayWidgetEntry>) -> Void) {
        Task {
            let now = Date()
            let entries = await TodayWidgetData.timeline(now: now, minutes: 15)
            completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(15 * 60))))
        }
    }
}

private struct TodayWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TodayWidgetEntry

    var body: some View {
        TodayWidgetView(entry: entry, family: family) {
            StartNextWidgetButton()
        } completeButton: {
            CompleteActiveWidgetButton()
        }
        .containerBackground(for: .widget) {
            switch family {
            case .accessoryRectangular, .accessoryInline, .accessoryCircular: Color.clear
            default: WidgetTheme.surfaceContainerLowest
            }
        }
    }
}
