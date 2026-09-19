import SwiftUI
import WidgetKit

/// One tap into Inbox capture. Widgets can't host a keyboard — `Button`/`Toggle` only run App
/// Intents, no free text — so this deep-links (`tempo://capture`) into the app's Inbox tab with
/// the capture field already focused, the fastest real capture a widget can offer. `TempoApp`'s
/// `onOpenURL` sets `AppModel.captureRequested`, which both `MainTabs` (switch to Inbox) and
/// `InboxView` (focus the field) react to.
struct QuickAddWidget: Widget {
    static let kind = "TempoQuickAdd"
    static let url = URL(string: "tempo://capture")!

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: QuickAddProvider()) { _ in
            QuickAddEntryView()
        }
        .configurationDisplayName("Add to Tempo")
        .description("One tap straight into Inbox capture.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryCircular])
    }
}

/// No real data — one entry, never refreshed.
struct QuickAddProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickAddEntry { QuickAddEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping @Sendable (QuickAddEntry) -> Void) {
        completion(QuickAddEntry(date: Date()))
    }
    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<QuickAddEntry>) -> Void) {
        completion(Timeline(entries: [QuickAddEntry(date: Date())], policy: .never))
    }
}

struct QuickAddEntry: TimelineEntry {
    var date: Date
}

private struct QuickAddEntryView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                Image(systemName: "plus")
                    .font(.system(size: 20, weight: .semibold))
            case .accessoryRectangular:
                HStack(spacing: 6) {
                    Image(systemName: "plus.circle.fill")
                    Text("Add to Tempo")
                        .font(.system(size: 14, weight: .medium))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            default:
                VStack(alignment: .leading, spacing: 0) {
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(WidgetTheme.primary)
                        .frame(width: 44, height: 44)
                        .background(WidgetTheme.primary.opacity(0.12), in: Circle())
                    Spacer(minLength: 12)
                    Text("Add to Tempo")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(WidgetTheme.onSurface)
                    Text("Tap to capture")
                        .font(.system(size: 12))
                        .foregroundStyle(WidgetTheme.onSurfaceVariant)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .widgetURL(QuickAddWidget.url)
        .containerBackground(for: .widget) {
            switch family {
            case .accessoryRectangular, .accessoryCircular: Color.clear
            default: WidgetTheme.surfaceContainerLowest
            }
        }
    }
}
