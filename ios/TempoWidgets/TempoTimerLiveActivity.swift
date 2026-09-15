import ActivityKit
import SwiftUI
import WidgetKit

/// The running timer on the Lock Screen, as a banner, and in the Dynamic Island.
struct TempoTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TempoTimerAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(WidgetTheme.surfaceContainerLowest)
                .activitySystemActionForegroundColor(WidgetTheme.primary)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ProgressRing(attributes: context.attributes, state: context.state)
                        .frame(width: 28, height: 28)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TimerClock(state: context.state)
                        .font(.system(size: 22, weight: .medium, design: .rounded))
                        .foregroundStyle(WidgetTheme.primary)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.todoTitle)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        ProgressBar(attributes: context.attributes, state: context.state)
                        HStack {
                            Text(context.state.isPaused ? "Paused" : "\(context.attributes.estimateMinutes)m planned")
                            Spacer()
                        }
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.7))
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                ProgressRing(attributes: context.attributes, state: context.state)
                    .frame(width: 18, height: 18)
                    .padding(.leading, 2)
            } compactTrailing: {
                TimerClock(state: context.state)
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundStyle(WidgetTheme.primary)
                    .frame(minWidth: 44)
                    .padding(.trailing, 2)
            } minimal: {
                TimerClock(state: context.state, showsHours: false)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(WidgetTheme.primary)
                    .minimumScaleFactor(0.6)
            }
            .keylineTint(WidgetTheme.primary)
        }
    }
}

// MARK: Lock Screen / banner

private struct LockScreenView: View {
    let attributes: TempoTimerAttributes
    let state: TempoTimerAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(state.isPaused ? "Paused" : "Focusing")
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(1)
                        .textCase(.uppercase)
                        .foregroundStyle(WidgetTheme.onSurfaceVariant)
                    Text(attributes.todoTitle)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(WidgetTheme.onSurface)
                        .lineLimit(2)
                }
                Spacer(minLength: 8)
                TimerClock(state: state)
                    .font(.system(size: 28, weight: .medium, design: .rounded))
                    .foregroundStyle(state.isPaused ? WidgetTheme.onSurfaceVariant : WidgetTheme.primary)
            }

            ProgressBar(attributes: attributes, state: state)

            Text("\(attributes.estimateMinutes)m planned")
                .font(.system(size: 12))
                .foregroundStyle(WidgetTheme.onSurfaceVariant)
        }
        .padding(16)
    }
}

// MARK: Pieces

/// A live clock while running (the system ticks it, no timeline needed); a frozen
/// elapsed while paused.
private struct TimerClock: View {
    let state: TempoTimerAttributes.ContentState
    var showsHours = true

    var body: some View {
        if let start = state.clockStart {
            Text(timerInterval: start...start.addingTimeInterval(24 * 60 * 60), countsDown: false, showsHours: showsHours)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
        } else {
            Text(WidgetTheme.formatElapsed(state.accumulatedSeconds))
                .monospacedDigit()
        }
    }
}

/// Thin sage bar: elapsed against the estimate, animated by the system while running.
private struct ProgressBar: View {
    let attributes: TempoTimerAttributes
    let state: TempoTimerAttributes.ContentState

    var body: some View {
        Group {
            if let start = state.clockStart {
                ProgressView(
                    timerInterval: start...start.addingTimeInterval(Double(attributes.estimateSeconds)),
                    countsDown: false,
                    label: { EmptyView() },
                    currentValueLabel: { EmptyView() }
                )
            } else {
                ProgressView(value: fraction)
            }
        }
        .progressViewStyle(.linear)
        .tint(WidgetTheme.primary)
        .frame(height: 4)
    }

    private var fraction: Double {
        min(1, Double(state.accumulatedSeconds) / Double(attributes.estimateSeconds))
    }
}

/// The same progress as a ring, for the Island's compact and expanded leading slots.
private struct ProgressRing: View {
    let attributes: TempoTimerAttributes
    let state: TempoTimerAttributes.ContentState

    var body: some View {
        if let start = state.clockStart {
            ProgressView(
                timerInterval: start...start.addingTimeInterval(Double(attributes.estimateSeconds)),
                countsDown: false,
                label: { EmptyView() },
                currentValueLabel: { EmptyView() }
            )
            .progressViewStyle(.circular)
            .tint(WidgetTheme.primary)
        } else {
            ZStack {
                Circle()
                    .stroke(WidgetTheme.primary.opacity(0.25), lineWidth: 3)
                Circle()
                    .trim(from: 0, to: fraction)
                    .stroke(WidgetTheme.primary, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Image(systemName: "pause.fill")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(WidgetTheme.primary)
            }
        }
    }

    private var fraction: Double {
        min(1, Double(state.accumulatedSeconds) / Double(attributes.estimateSeconds))
    }
}
