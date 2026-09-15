import SwiftUI
import TempoKit

/// One task at a time. Port of `FocusMode.tsx`: walks Today in order, auto-starts the
/// timer on the current task, and offers Not now · Done · Skip, a break, a peek at
/// what's next, and a quick-capture field so a stray thought doesn't break the flow.
/// The task on the clock decides which one is current, so opening Focus Mode from a
/// running Now card lands on that task with its elapsed time intact.
struct FocusModeView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    private enum Phase { case focus, transition, breakTime }

    @State private var currentIndex = 0
    @State private var phase: Phase = .focus
    @State private var showNext = false
    @State private var captureText = ""
    @State private var captureFlash = false
    @State private var completions = 0
    /// Light tap when the timer starts, pauses for a break, or resumes.
    @State private var timerTaps = 0
    @State private var advanceTask: Task<Void, Never>?

    private var focusTodos: [Todo] { model.todayTodos }

    private var activeIndex: Int? {
        guard let id = model.timer.activeTaskId else { return nil }
        return focusTodos.firstIndex { $0.id == id }
    }

    private var effectiveIndex: Int { activeIndex ?? currentIndex }

    private var currentTodo: Todo? {
        focusTodos.indices.contains(effectiveIndex) ? focusTodos[effectiveIndex] : nil
    }

    private var nextTodo: Todo? {
        let next = effectiveIndex + 1
        return focusTodos.indices.contains(next) ? focusTodos[next] : nil
    }

    /// Elapsed on the current task; 0 while the clock belongs to nothing.
    private var elapsedSeconds: Int {
        guard let current = currentTodo, model.timer.activeTaskId == current.id else { return 0 }
        return model.elapsedSeconds
    }

    private var estimateMinutes: Int { currentTodo.map { TimeMath.getEstimate($0) } ?? 0 }
    private var estimateSeconds: Int { estimateMinutes * 60 }
    private var progress: Double {
        estimateSeconds > 0 ? min(1, Double(elapsedSeconds) / Double(estimateSeconds)) : 0
    }
    private var isOvertime: Bool { elapsedSeconds > estimateSeconds }

    var body: some View {
        ZStack {
            Theme.surface.ignoresSafeArea()

            if !model.hasLoaded {
                Text("Loading...")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
            } else if let todo = currentTodo {
                session(todo)
            } else {
                allDone
            }
        }
        .tint(Theme.primary)
        .sensoryFeedback(.success, trigger: completions)
        .sensoryFeedback(.impact(weight: .light), trigger: timerTaps)
        .onAppear(perform: autoStart)
        .onChange(of: currentTodo?.id) { _, _ in autoStart() }
        .onChange(of: phase) { _, _ in autoStart() }
        .onDisappear { advanceTask?.cancel() }
    }

    // MARK: Screens

    private func session(_ todo: Todo) -> some View {
        VStack(spacing: 0) {
            HStack {
                Button {
                    dismiss()
                } label: {
                    Text("← Today")
                        .font(Theme.font(.subheadline))
                        .foregroundStyle(Theme.onSurfaceVariant)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back to Today")

                Spacer()

                Text("\(effectiveIndex + 1) of \(focusTodos.count)")
                    .font(Theme.font(.caption))
                    .monospacedDigit()
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
            .padding(.horizontal, Theme.grid * 3)
            .padding(.vertical, Theme.grid)

            Spacer(minLength: Theme.grid * 2)

            Group {
                switch phase {
                case .focus: focus(todo)
                case .transition: transition
                case .breakTime: breakScreen
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Theme.grid * 3)
            .animation(.easeOut(duration: 0.3), value: phase)

            Spacer(minLength: Theme.grid * 2)

            captureBar
                .padding(.horizontal, Theme.grid * 3)
                .padding(.vertical, Theme.grid * 2)
        }
    }

    private func focus(_ todo: Todo) -> some View {
        VStack(spacing: Theme.grid * 4) {
            ring

            VStack(spacing: Theme.grid) {
                Text(todo.title)
                    .font(Theme.display(.title2))
                    .foregroundStyle(Theme.onSurface)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                if let project = todo.project, !project.isEmpty {
                    Text(project)
                        .font(Theme.font(.subheadline))
                        .foregroundStyle(Theme.onSurfaceVariant)
                }
            }
            .frame(maxWidth: 448)

            HStack(spacing: Theme.grid * 1.5) {
                Button("Not now", action: notNow)
                    .buttonStyle(SecondaryButtonStyle())
                Button("Done", action: done)
                    .buttonStyle(FocusPrimaryButtonStyle())
                Button("Skip", action: skip)
                    .buttonStyle(SecondaryButtonStyle())
            }

            VStack(spacing: Theme.grid * 1.5) {
                Button("Take a break", action: takeBreak)
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.5))
                    .frame(minHeight: 32)

                if let next = nextTodo {
                    Button {
                        showNext.toggle()
                    } label: {
                        if showNext {
                            (Text("Up next: ").foregroundStyle(Theme.onSurfaceVariant.opacity(0.4))
                             + Text(next.title).foregroundStyle(Theme.onSurfaceVariant))
                        } else {
                            Text("Peek at what's next")
                                .foregroundStyle(Theme.onSurfaceVariant.opacity(0.4))
                        }
                    }
                    .font(Theme.font(.caption))
                    .multilineTextAlignment(.center)
                    .frame(minHeight: 32)
                    .animation(.easeOut(duration: 0.2), value: showNext)
                }
            }
            .buttonStyle(.plain)
        }
    }

    /// A 200pt sage ring; past the estimate it stays full at 40% opacity, never red.
    private var ring: some View {
        ZStack {
            Circle()
                .stroke(Theme.surfaceContainerHigh, lineWidth: 6)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(Theme.primary.opacity(isOvertime ? 0.4 : 1), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 1), value: progress)
                .animation(.easeOut(duration: 0.3), value: isOvertime)

            VStack(spacing: 4) {
                Text(TimeMath.formatElapsed(elapsedSeconds))
                    .font(Theme.mono(size: 30, weight: .light))
                    .monospacedDigit()
                    .foregroundStyle(isOvertime ? Theme.primary : Theme.onSurface)
                Text("of \(TimeMath.formatMinutes(estimateMinutes))")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
        }
        .frame(width: 200, height: 200)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(TimeMath.formatElapsed(elapsedSeconds)) of \(TimeMath.formatMinutes(estimateMinutes))")
    }

    private var transition: some View {
        VStack(spacing: Theme.grid * 3) {
            ZStack {
                Circle()
                    .fill(Theme.primary.opacity(0.1))
                    .frame(width: 80, height: 80)
                Image(systemName: "checkmark")
                    .font(.system(size: 34, weight: .medium))
                    .foregroundStyle(Theme.primary)
            }
            Text("Take a breath...")
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurfaceVariant)
        }
        .transition(.opacity.combined(with: .scale(scale: 0.96)))
    }

    private var breakScreen: some View {
        VStack(spacing: Theme.grid * 3) {
            ZStack {
                Circle()
                    .fill(Theme.surfaceContainerHigh)
                    .frame(width: 80, height: 80)
                Image(systemName: "cup.and.saucer.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
            Text("Taking a break")
                .font(Theme.display(.title3, weight: .semibold))
                .foregroundStyle(Theme.onSurface)
            Text("Timer paused at \(TimeMath.formatElapsed(elapsedSeconds))")
                .font(Theme.font(.subheadline))
                .monospacedDigit()
                .foregroundStyle(Theme.onSurfaceVariant)
            Button("Resume", action: resumeFromBreak)
                .buttonStyle(FocusPrimaryButtonStyle())
                .padding(.top, Theme.grid)
        }
        .transition(.opacity)
    }

    private var allDone: some View {
        VStack(spacing: Theme.grid * 2) {
            ZStack {
                Circle()
                    .fill(Theme.primary.opacity(0.1))
                    .frame(width: 64, height: 64)
                Image(systemName: "checkmark")
                    .font(.system(size: 28, weight: .medium))
                    .foregroundStyle(Theme.primary)
            }
            Text("All done")
                .font(Theme.display(.title2))
                .foregroundStyle(Theme.onSurface)
            Text("Nothing left on your plate. Nice work.")
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurfaceVariant)
                .multilineTextAlignment(.center)
            Button("Back to Today") { dismiss() }
                .buttonStyle(FocusPrimaryButtonStyle())
                .padding(.top, Theme.grid * 2)
        }
        .padding(.horizontal, Theme.grid * 3)
    }

    /// Quick capture straight to Inbox; the field stays put so the flow isn't broken.
    private var captureBar: some View {
        HStack(spacing: Theme.grid) {
            HStack(spacing: Theme.grid) {
                Image(systemName: "arrow.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.4))
                TextField("Capture a thought to Inbox...", text: $captureText)
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurface)
                    .submitLabel(.done)
                    .onSubmit(capture)
                    .accessibilityLabel("Capture a thought to Inbox")
            }
            .padding(.horizontal, Theme.grid * 2)
            .frame(minHeight: 44)
            .background(
                captureFlash ? Theme.primary.opacity(0.12) : Theme.surfaceContainerLow,
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .animation(.easeOut(duration: 0.3), value: captureFlash)

            if !captureText.trimmingCharacters(in: .whitespaces).isEmpty {
                Button("Save", action: capture)
                    .buttonStyle(FocusPrimaryButtonStyle())
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.2), value: captureText.isEmpty)
    }

    // MARK: Actions

    /// Puts the current task on the clock unless it already is. A paused clock on the
    /// same task (a break taken on the Now card) is resumed rather than restarted.
    private func autoStart() {
        guard phase == .focus, let todo = currentTodo else { return }
        if model.timer.activeTaskId == todo.id {
            if model.timer.isPaused {
                model.resumeTimer()
                timerTaps += 1
            }
        } else if !model.timer.isRunning {
            model.startTimer(todo.id)
            timerTaps += 1
        }
    }

    private func done() {
        guard currentTodo != nil else { return }
        let nextId = nextTodo?.id
        phase = .transition
        completions += 1
        advanceTask?.cancel()
        advanceTask = Task {
            await model.completeActive()
            try? await Task.sleep(for: .seconds(3.5))
            guard !Task.isCancelled else { return }
            advance(to: nextId)
        }
    }

    private func skip() {
        guard currentTodo != nil else { return }
        let nextId = nextTodo?.id
        model.stopTimer()
        advance(to: nextId)
    }

    /// Defers a pinned task to tomorrow; drops a suggested one from today's set.
    private func notNow() {
        guard let todo = currentTodo else { return }
        let nextId = nextTodo?.id
        model.stopTimer()
        Task {
            if todo.status == .todayPinned {
                await model.defer(id: todo.id, until: DeferDates.tomorrow(calendar: model.calendar))
            } else {
                await model.dismissFromToday(id: todo.id)
            }
            advance(to: nextId)
        }
    }

    private func takeBreak() {
        model.pauseTimer()
        timerTaps += 1
        phase = .breakTime
    }

    private func resumeFromBreak() {
        model.resumeTimer()
        timerTaps += 1
        phase = .focus
    }

    /// Moves on to `id` and starts its clock; with nothing left, closes Focus Mode.
    private func advance(to id: UUID?) {
        showNext = false
        if let id, let index = focusTodos.firstIndex(where: { $0.id == id }) {
            currentIndex = index
            model.startTimer(id)
            phase = .focus
        } else {
            model.stopTimer()
            dismiss()
        }
    }

    private func capture() {
        let title = captureText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        captureText = ""
        captureFlash = true
        Task {
            await model.createTodo(title: title, status: .inbox)
            try? await Task.sleep(for: .milliseconds(600))
            captureFlash = false
        }
    }
}

/// Focus Mode's primary action: solid sage, 12pt radius, hugging its label.
struct FocusPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.font(.subheadline, weight: .medium))
            .foregroundStyle(Theme.onPrimary)
            .padding(.horizontal, Theme.grid * 4)
            .frame(minHeight: 44)
            .background(
                configuration.isPressed ? Theme.primaryDim : Theme.primary,
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .animation(.easeOut(duration: 0.2), value: configuration.isPressed)
    }
}
