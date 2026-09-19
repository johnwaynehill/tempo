#if DEBUG
import ActivityKit
import Foundation
import SwiftUI
import TempoKit
import WidgetKit
import os

/// DEBUG hooks for the widget and App Intents, driven by environment variables (see README,
/// "Debug launch hooks"):
///
/// - `TEMPO_DEBUG_RUN_INTENT=startNext|add:<title>|today|focus` runs that intent's `perform()`
///   once the scene is active, with no app model registered — the path a widget tap or Shortcut
///   takes when the app isn't running — then logs the shared timer, the Live Activity count and
///   the inbox, registers the model and calls `activate()` so the app picks up the result.
/// - `TEMPO_DEBUG_WIDGET_GALLERY=1` covers the app with `WidgetGalleryView`.
@MainActor
enum IntentDebugLaunch {
    private static let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "debug")
    private static var started = false
    private static var finished = false

    static var requestedIntent: String? {
        guard let spec = ProcessInfo.processInfo.environment["TEMPO_DEBUG_RUN_INTENT"], !spec.isEmpty else { return nil }
        return spec
    }

    static var showsWidgetGallery: Bool {
        ProcessInfo.processInfo.environment["TEMPO_DEBUG_WIDGET_GALLERY"] == "1"
    }

    /// While the requested intent hasn't run, the app keeps its model out of `TempoIntentBridge`.
    static var holdsHost: Bool { requestedIntent != nil && !finished }

    static func runIfRequested(host: any TempoIntentHost, whenDone: @escaping @MainActor () async -> Void) {
        guard let spec = requestedIntent, !started else { return }
        started = true
        Task {
            log.info("run-intent: \(spec, privacy: .public) host=\(TempoIntentBridge.host == nil ? "none" : "app", privacy: .public)")
            do {
                switch spec {
                case "startNext": _ = try await StartNextTaskIntent().perform()
                case "today": _ = try await WhatsOnTodayIntent().perform()
                case "focus": _ = try await StartFocusIntent().perform()
                // Not an intent: clears the shared timer as another process would, so the
                // `activate()` below exercises the model dropping a clock stopped elsewhere.
                case "clearTimer": AppGroup.defaults.removeObject(forKey: AppGroup.timerStateKey)
                case let s where s.hasPrefix("add:"): _ = try await AddTodoIntent(title: String(s.dropFirst(4))).perform()
                default: log.info("run-intent: unknown intent \(spec, privacy: .public)")
                }
            } catch {
                log.error("run-intent: \(spec, privacy: .public) threw \(String(describing: error), privacy: .public)")
            }
            // Activity.request registers asynchronously; give it a beat before counting.
            try? await Task.sleep(for: .seconds(1))
            let timer = AppGroup.defaults.data(forKey: AppGroup.timerStateKey).map { String(decoding: $0, as: UTF8.self) } ?? "nil"
            let inbox = AppGroup.inboxURL.flatMap { try? FileManager.default.contentsOfDirectory(atPath: $0.path) } ?? []
            log.info("run-intent: after \(spec, privacy: .public): sharedTimer=\(timer, privacy: .public) activities=\(Activity<TempoTimerAttributes>.activities.count) inbox=\(inbox.joined(separator: ","), privacy: .public)")
            finished = true
            TempoIntentBridge.host = host
            await whenDone()
        }
    }
}

/// The Today widget at (approximately) its real iPhone 17 Pro Max sizes, fed by the same
/// `TodayWidgetData.entry()` the timeline provider uses and re-read every two seconds, so it can
/// be screenshotted without adding widgets to the Home Screen.
struct WidgetGalleryView: View {
    @State private var entry: TodayWidgetEntry?
    @State private var habitsEntry: HabitsWidgetEntry?

    var body: some View {
        ScrollView {
        // Medium on top, the rest at the bottom: the middle of the screen is where system alerts
        // (the first-launch notification prompt) land, and nothing here can tap them away.
        VStack(alignment: .leading, spacing: 16) {
                Text("Widget gallery")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(WidgetTheme.onSurfaceVariant)

                if let entry {
                    tile(entry, family: .systemLarge, size: CGSize(width: 364, height: 382))
                    caption("entry \(entry.date.formatted(date: .omitted, time: .standard))")
                    Spacer(minLength: 16)
                    tile(entry, family: .systemMedium, size: CGSize(width: 364, height: 170))
                    Spacer(minLength: 16)
                    HStack(alignment: .top, spacing: 24) {
                        tile(entry, family: .systemSmall, size: CGSize(width: 170, height: 170))
                        VStack(alignment: .leading, spacing: 6) {
                            caption("accessoryRectangular")
                            TodayWidgetView(entry: entry, family: .accessoryRectangular) { StartNextWidgetButton() } completeButton: { CompleteActiveWidgetButton() }
                                .foregroundStyle(.white)
                                .frame(width: 172, height: 76)
                                .environment(\.colorScheme, .dark)
                            HStack(alignment: .center, spacing: 12) {
                                VStack(alignment: .leading, spacing: 6) {
                                    caption("accessoryInline")
                                    TodayWidgetView(entry: entry, family: .accessoryInline) { StartNextWidgetButton() } completeButton: { CompleteActiveWidgetButton() }
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundStyle(.white)
                                        .lineLimit(1)
                                        .frame(width: 132, height: 26, alignment: .leading)
                                        .environment(\.colorScheme, .dark)
                                }
                                VStack(spacing: 6) {
                                    caption("accessoryCircular")
                                    TodayWidgetView(entry: entry, family: .accessoryCircular) { StartNextWidgetButton() } completeButton: { CompleteActiveWidgetButton() }
                                        .foregroundStyle(.white)
                                        .frame(width: 40, height: 40)
                                        .environment(\.colorScheme, .dark)
                                }
                            }
                        }
                        .padding(12)
                        .background(Color.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                } else {
                    ProgressView()
                }

                Spacer(minLength: 16)

                if let habitsEntry {
                    caption("Habits — systemSmall / systemMedium")
                    HStack(alignment: .top, spacing: 24) {
                        habitsTile(habitsEntry, family: .systemSmall, size: CGSize(width: 170, height: 170))
                        habitsTile(habitsEntry, family: .systemMedium, size: CGSize(width: 170, height: 170))
                    }
                }

                Spacer(minLength: 16)

                caption("Add to Tempo — systemSmall")
                QuickAddPreview()
                    .padding(16)
                    .frame(width: 170, height: 170)
                    .background(WidgetTheme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .padding(24)
        .padding(.top, 32)
        .padding(.bottom, 24)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .background(Color(red: 0.62, green: 0.70, blue: 0.66).ignoresSafeArea())
        .task {
            while !Task.isCancelled {
                entry = await TodayWidgetData.entry()
                habitsEntry = await HabitsWidgetData.entry()
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    private func habitsTile(_ entry: HabitsWidgetEntry, family: WidgetFamily, size: CGSize) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HabitsWidgetView(entry: entry, family: family) { habitId, completedToday in
                ToggleHabitWidgetButton(habitId: habitId, date: DayMath.isoDateString(entry.date), completedToday: completedToday)
            }
            .padding(16)
            .frame(width: size.width, height: size.height)
            .background(WidgetTheme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
    }

    private func tile(_ entry: TodayWidgetEntry, family: WidgetFamily, size: CGSize) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            caption(familyName(family))
            TodayWidgetView(entry: entry, family: family) { StartNextWidgetButton() } completeButton: { CompleteActiveWidgetButton() }
                .padding(16)
                .frame(width: size.width, height: size.height)
                .background(WidgetTheme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
    }

    private func familyName(_ family: WidgetFamily) -> String {
        switch family {
        case .systemSmall: "systemSmall"
        case .systemLarge: "systemLarge"
        default: "systemMedium"
        }
    }

    private func caption(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(.white.opacity(0.9))
    }
}

/// Mirrors `QuickAddWidget`'s systemSmall layout (that view is private to its own file, and
/// has nothing dynamic worth threading through here).
private struct QuickAddPreview: View {
    var body: some View {
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
#endif
