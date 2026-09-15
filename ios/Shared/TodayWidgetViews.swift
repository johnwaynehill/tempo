import SwiftUI
import TempoKit
import WidgetKit

/// The Today widget's views, shared by the widget extension and the app's DEBUG widget gallery.
/// The family is passed in rather than read from the environment so the gallery can draw every
/// size outside WidgetKit, and the Start next button is injected because the intent it runs lives
/// in `ios/Intents`, which this folder's other clients (the share extension) don't compile.
///
/// Quiet Rhythm in a small space: no borders, one surface, sage only for the thing to act on
/// (the clock, "done by", Start next), system type with rounded numerals.
struct TodayWidgetView<StartButton: View>: View {
    let entry: TodayWidgetEntry
    let family: WidgetFamily
    let startButton: StartButton

    init(entry: TodayWidgetEntry, family: WidgetFamily, @ViewBuilder startButton: () -> StartButton) {
        self.entry = entry
        self.family = family
        self.startButton = startButton()
    }

    var body: some View {
        switch family {
        case .systemMedium: medium
        case .accessoryRectangular: rectangular
        case .accessoryInline: inline
        default: small
        }
    }

    // MARK: Small

    @ViewBuilder
    private var small: some View {
        switch entry.content {
        case .tasks(let day):
            if let clock = day.clock {
                VStack(alignment: .leading, spacing: 0) {
                    WidgetLabel(text: clock.isPaused ? "Paused" : "Focusing")
                    Text(clock.task.title)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(WidgetTheme.onSurface)
                        .lineLimit(3)
                        .padding(.top, 6)
                    Spacer(minLength: 4)
                    TodayWidgetClockText(clock: clock)
                        .font(.system(size: 28, weight: .medium, design: .rounded))
                        .foregroundStyle(clock.isPaused ? WidgetTheme.onSurfaceVariant : WidgetTheme.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text("of \(TimeMath.formatMinutes(clock.task.estimateMinutes))")
                        .font(.system(size: 12))
                        .foregroundStyle(WidgetTheme.onSurfaceVariant)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    WidgetLabel(text: "Today")
                    Spacer(minLength: 4)
                    Text("\(day.tasks.count)")
                        .font(.system(size: 44, weight: .medium, design: .rounded))
                        .foregroundStyle(WidgetTheme.onSurface)
                        .contentTransition(.numericText())
                    Text(day.tasks.count == 1 ? "task left" : "tasks left")
                        .font(.system(size: 14))
                        .foregroundStyle(WidgetTheme.onSurfaceVariant)
                    Spacer(minLength: 8)
                    Text(day.doneByLine)
                        .font(.system(size: 12, weight: .medium))
                        .monospacedDigit()
                        .foregroundStyle(WidgetTheme.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .accessibilityElement(children: .combine)
            }
        default:
            quietState
        }
    }

    // MARK: Medium

    @ViewBuilder
    private var medium: some View {
        switch entry.content {
        case .tasks(let day):
            if let clock = day.clock {
                mediumRunning(day: day, clock: clock)
            } else {
                mediumIdle(day: day)
            }
        default:
            quietState
        }
    }

    private func mediumIdle(day: TodayWidgetTasks) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center) {
                WidgetLabel(text: "Today")
                Spacer(minLength: 8)
                startButton
            }
            .frame(height: 28)

            VStack(alignment: .leading, spacing: 8) {
                ForEach(day.tasks.prefix(3)) { task in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(task.title)
                            .font(.system(size: 14))
                            .foregroundStyle(WidgetTheme.onSurface)
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        Text(TimeMath.formatMinutes(task.estimateMinutes))
                            .font(.system(size: 12))
                            .monospacedDigit()
                            .foregroundStyle(WidgetTheme.onSurfaceVariant)
                    }
                }
            }
            .padding(.top, 10)

            Spacer(minLength: 6)

            Text(day.summaryLine)
                .font(.system(size: 12))
                .monospacedDigit()
                .foregroundStyle(WidgetTheme.onSurfaceVariant)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func mediumRunning(day: TodayWidgetTasks, clock: TodayWidgetClock) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    WidgetLabel(text: clock.isPaused ? "Paused" : "Focusing")
                    Text(clock.task.title)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(WidgetTheme.onSurface)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                TodayWidgetClockText(clock: clock)
                    .font(.system(size: 30, weight: .medium, design: .rounded))
                    .foregroundStyle(clock.isPaused ? WidgetTheme.onSurfaceVariant : WidgetTheme.primary)
                    .multilineTextAlignment(.trailing)
                    .lineLimit(1)
                    .frame(maxWidth: 120, alignment: .trailing)
            }

            Spacer(minLength: 8)

            TodayWidgetProgress(clock: clock)

            HStack(alignment: .firstTextBaseline) {
                if let next = day.upNext.first {
                    Text("Up next: \(next.title)")
                        .lineLimit(1)
                } else {
                    Text("Last one today")
                }
                Spacer(minLength: 8)
                Text(day.doneByLine)
                    .monospacedDigit()
                    .fixedSize()
            }
            .font(.system(size: 12))
            .foregroundStyle(WidgetTheme.onSurfaceVariant)
            .padding(.top, 10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    // MARK: Lock Screen

    @ViewBuilder
    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            switch entry.content {
            case .tasks(let day):
                if let clock = day.clock {
                    Text(clock.task.title)
                        .font(.system(size: 15, weight: .semibold))
                        .lineLimit(1)
                        .widgetAccentable()
                    TodayWidgetClockText(clock: clock)
                        .font(.system(size: 22, weight: .medium, design: .rounded))
                        .lineLimit(1)
                    Text(clock.isPaused ? "Paused" : "of \(TimeMath.formatMinutes(clock.task.estimateMinutes))")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                } else {
                    Text("\(day.countLine) left")
                        .font(.system(size: 15, weight: .semibold))
                        .widgetAccentable()
                    if let next = day.tasks.first {
                        Text(next.title)
                            .font(.system(size: 14))
                            .lineLimit(1)
                    }
                    Text(day.doneByLine)
                        .font(.system(size: 13))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            default:
                let copy = quietCopy
                Text(copy.title)
                    .font(.system(size: 15, weight: .semibold))
                    .widgetAccentable()
                Text(copy.message)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var inline: some View {
        switch entry.content {
        case .tasks(let day):
            if let clock = day.clock, let start = clock.clockStart {
                Text("\(Text(timerInterval: start...start.addingTimeInterval(24 * 60 * 60), countsDown: false)) · \(clock.task.title)")
            } else if let clock = day.clock {
                Text("Paused · \(clock.task.title)")
            } else {
                Text("\(day.tasks.count) left · \(day.doneByLine)")
            }
        default:
            Text(quietCopy.title)
        }
    }

    // MARK: Quiet states

    private var quietCopy: (title: String, message: String) {
        switch entry.content {
        case .signedOut:
            ("Tempo", "Open Tempo to sign in.")
        case .notLoaded:
            ("Almost ready", "Open Tempo to load Today.")
        case .empty(let done) where done > 0:
            ("All done", "You knocked out \(done) task\(done == 1 ? "" : "s") today.")
        default:
            ("Clear skies", "Nothing on your plate.")
        }
    }

    private var quietState: some View {
        let copy = quietCopy
        return VStack(alignment: .leading, spacing: 0) {
            WidgetLabel(text: "Today")
            Spacer(minLength: 8)
            Text(copy.title)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(WidgetTheme.onSurface)
            Text(copy.message)
                .font(.system(size: 13))
                .foregroundStyle(WidgetTheme.onSurfaceVariant)
                .lineLimit(2)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// The widget's Start next pill: sage text on a faint sage wash, no border.
struct TodayWidgetStartLabel: View {
    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "play.fill")
                .font(.system(size: 9, weight: .bold))
            Text("Start next")
                .font(.system(size: 12, weight: .medium))
        }
        .foregroundStyle(WidgetTheme.primary)
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(WidgetTheme.primary.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .accessibilityLabel("Start the next task")
    }
}

/// Small uppercase section label, as on the Live Activity.
private struct WidgetLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .tracking(1)
            .textCase(.uppercase)
            .foregroundStyle(WidgetTheme.onSurfaceVariant)
    }
}

/// A live count-up clock while running (the system ticks it); the banked time while paused.
struct TodayWidgetClockText: View {
    let clock: TodayWidgetClock

    var body: some View {
        if let start = clock.clockStart {
            Text(timerInterval: start...start.addingTimeInterval(24 * 60 * 60), countsDown: false)
                .monospacedDigit()
        } else {
            Text(WidgetTheme.formatElapsed(clock.accumulatedSeconds))
                .monospacedDigit()
        }
    }
}

/// Thin sage bar against the estimate; the system animates it while the clock runs.
private struct TodayWidgetProgress: View {
    let clock: TodayWidgetClock

    var body: some View {
        Group {
            if let start = clock.clockStart {
                ProgressView(
                    timerInterval: start...start.addingTimeInterval(Double(clock.estimateSeconds)),
                    countsDown: false,
                    label: { EmptyView() },
                    currentValueLabel: { EmptyView() }
                )
            } else {
                ProgressView(value: min(1, Double(clock.accumulatedSeconds) / Double(clock.estimateSeconds)))
            }
        }
        .progressViewStyle(.linear)
        .tint(WidgetTheme.primary)
        .frame(height: 4)
        .accessibilityHidden(true)
    }
}
