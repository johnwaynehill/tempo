import SwiftUI
import TempoKit

/// The running task, lifted out of the list into a card with its timer and controls.
/// Mirrors `NowCard.tsx`: title and project, elapsed / estimate, a thin sage progress
/// bar that stays full past the estimate (no red, no pulse), pause / stop, and the
/// complete circle on the right.
struct NowCard: View {
    let todo: Todo
    let timer: TimerState
    let elapsedSeconds: Int
    var onPause: () -> Void
    var onResume: () -> Void
    var onStop: () -> Void
    var onComplete: () -> Void

    @State private var completing = false

    private var estimateMinutes: Int { TimeMath.getEstimate(todo) }
    private var estimateSeconds: Int { max(60, estimateMinutes * 60) }
    private var isOvertime: Bool { elapsedSeconds > estimateSeconds }
    private var progress: Double { min(1, Double(elapsedSeconds) / Double(estimateSeconds)) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: Theme.grid * 1.5) {
                NavigationLink(value: todo.id) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(todo.title)
                            .font(Theme.font(size: 15))
                            .foregroundStyle(completing ? Theme.onSurfaceVariant : Theme.onSurface)
                            .strikethrough(completing, color: Theme.onSurfaceVariant)
                            .lineSpacing(3)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        if let project = todo.project, !project.isEmpty {
                            Chip(text: project, background: Theme.primaryContainer, foreground: Theme.onSurface)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                (Text(TimeMath.formatElapsed(elapsedSeconds))
                    .foregroundStyle(isOvertime ? Theme.primary : Theme.onSurfaceVariant)
                 + Text(" / \(TimeMath.formatMinutes(estimateMinutes))")
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.5)))
                    .font(Theme.mono(size: 14))
                    .monospacedDigit()
                    .lineLimit(1)
                    .fixedSize()
                    .accessibilityLabel("\(TimeMath.formatElapsed(elapsedSeconds)) of \(TimeMath.formatMinutes(estimateMinutes))")
            }

            progressBar
                .padding(.top, Theme.grid * 1.5)

            controls
                .padding(.top, Theme.grid)
        }
        .padding(.horizontal, Theme.grid * 2)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .background(
            Theme.surfaceContainerLowest,
            in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
        )
        .opacity(completing ? 0 : 1)
        .offset(x: completing ? 16 : 0)
        .animation(.easeOut(duration: 0.5), value: completing)
        .sensoryFeedback(.success, trigger: completing) { _, new in new }
    }

    /// Fills with sage to the estimate; past it, stays full at 40% opacity.
    private var progressBar: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.surfaceContainerHigh)
                Capsule()
                    .fill(Theme.primary.opacity(isOvertime ? 0.4 : 1))
                    .frame(width: proxy.size.width * progress)
                    .animation(.linear(duration: 1), value: progress)
                    .animation(.easeOut(duration: 0.3), value: isOvertime)
            }
        }
        .frame(height: 4)
        .accessibilityHidden(true)
    }

    private var controls: some View {
        HStack(spacing: 4) {
            IconButton(symbol: timer.isPaused ? "play.fill" : "pause.fill",
                       label: timer.isPaused ? "Resume timer" : "Pause timer") {
                timer.isPaused ? onResume() : onPause()
            }
            IconButton(symbol: "stop.fill", label: "Stop timer", action: onStop)

            if timer.isPaused {
                Text("Paused")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.6))
                    .padding(.leading, 4)
                    .transition(.opacity)
            }

            Spacer(minLength: Theme.grid)

            Button {
                guard !completing else { return }
                completing = true
                Task {
                    try? await Task.sleep(for: .milliseconds(500))
                    onComplete()
                }
            } label: {
                ZStack {
                    Circle()
                        .strokeBorder(completing ? Theme.primary : Theme.outlineVariant, lineWidth: 2)
                        .background(Circle().fill(completing ? Theme.primary : .clear))
                        .frame(width: 20, height: 20)
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.onPrimary)
                        .opacity(completing ? 1 : 0)
                }
                .scaleEffect(completing ? 1.15 : 1)
                .animation(.spring(duration: 0.3), value: completing)
                .frame(width: 44, height: 44)
                .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(completing)
            .accessibilityLabel("Complete \"\(todo.title)\"")
        }
        .animation(.easeOut(duration: 0.2), value: timer.isPaused)
    }
}

/// The web's `ICON_BUTTON`: a quiet 36pt glyph inside a 44pt target.
private struct IconButton: View {
    var symbol: String
    var label: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.onSurfaceVariant)
                .frame(width: 36, height: 36)
                .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

#Preview {
    NavigationStack {
        VStack {
            NowCard(
                todo: Todo(title: "Write the iOS README", project: "Tempo", estimatedMinutes: 30),
                timer: TimerState(activeTaskId: UUID(), startedAt: Date(), accumulatedSeconds: 765, runningSince: Date()),
                elapsedSeconds: 765,
                onPause: {}, onResume: {}, onStop: {}, onComplete: {}
            )
        }
        .padding()
        .background(Theme.surface)
    }
}
