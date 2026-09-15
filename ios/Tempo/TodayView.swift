import SwiftUI
import TempoKit

struct TodayView: View {
    @Environment(Session.self) private var session
    @Environment(AppModel.self) private var model

    @State private var showFocus = false

    var body: some View {
        TodayContent(model: TodayViewModel(model: model))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showFocus = true
                    } label: {
                        Image(systemName: "target")
                            .foregroundStyle(Theme.onSurfaceVariant)
                    }
                    .accessibilityLabel("Focus mode")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let email = session.me?.email {
                            Text(email)
                        }
                        Button("Sign out", role: .destructive) {
                            Task {
                                await model.signOut()
                                session.signOut()
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .foregroundStyle(Theme.onSurfaceVariant)
                    }
                    .accessibilityLabel("Menu")
                }
            }
            .toolbarTitleDisplayMode(.inline)
            .fullScreenCover(isPresented: $showFocus) {
                FocusModeView()
                    .environment(model)
            }
            .onChange(of: model.focusRequested, initial: true) { _, requested in
                // The Start focus App Intent asked for Focus Mode.
                guard requested else { return }
                model.focusRequested = false
                showFocus = true
            }
            .task {
                await model.loadIfNeeded()
                #if DEBUG
                await DebugLaunch.run(model: model) { showFocus = true }
                #endif
            }
    }
}

private struct TodayContent: View {
    let model: TodayViewModel

    /// Light tap when a timer starts from this screen; success when the context menu completes.
    @State private var timerStarts = 0
    @State private var menuCompletions = 0

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "EEEE, MMM d"
        return f
    }()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                PageHeader(title: "Today", subtitle: Self.dateFormatter.string(from: Date()))
                    .padding(.bottom, model.showsOfflineBanner ? Theme.grid : Theme.grid * 3)

                if model.showsOfflineBanner {
                    Text("Offline. Changes will sync when you're back.")
                        .font(Theme.font(.footnote))
                        .foregroundStyle(Theme.onSurfaceVariant)
                        .padding(.bottom, Theme.grid * 2)
                        .transition(.opacity)
                }

                MoodRow()
                    .padding(.bottom, Theme.grid * 2)

                eventsSection
                    .padding(.bottom, Theme.grid * 3)

                if let error = model.error, !model.hasLoaded {
                    errorState(error)
                } else if !model.hasLoaded {
                    loadingState
                } else {
                    if let error = model.error {
                        Text(error)
                            .font(Theme.font(.footnote))
                            .foregroundStyle(Theme.error)
                            .padding(.bottom, Theme.grid * 2)
                    }
                    tasks
                }
            }
            .padding(.horizontal, Theme.grid * 2)
            .padding(.top, Theme.grid)
            .padding(.bottom, Theme.grid * 6)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.surface.ignoresSafeArea())
        .refreshable { await model.reload() }
        .animation(.easeOut(duration: 0.3), value: model.hasLoaded)
        .animation(.easeOut(duration: 0.3), value: model.showsOfflineBanner)
        .sensoryFeedback(.impact(weight: .light), trigger: timerStarts)
        .sensoryFeedback(.success, trigger: menuCompletions)
    }

    // MARK: Events

    private var eventsSection: some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            SectionLabel(text: "Today's events")

            if model.todayEvents.isEmpty {
                Text(model.hasLoaded ? "No events today" : " ")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .frame(minHeight: 40)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(model.todayEvents) { event in
                        EventRow(event: event)
                    }
                }
            }
        }
    }

    // MARK: Tasks

    @ViewBuilder
    private var tasks: some View {
        if let summary = model.summary {
            daySummary(summary)
        }

        if let active = model.activeTodo {
            NowCard(
                todo: active,
                timer: model.timer,
                elapsedSeconds: model.elapsedSeconds,
                onPause: model.pause,
                onResume: model.resume,
                onStop: model.stop,
                onComplete: { Task { await model.completeActive() } }
            )
            .padding(.bottom, Theme.grid * 1.5)
            .transition(.opacity)
        }

        if model.todayTodos.isEmpty {
            let done = model.completedTodayCount
            EmptyState(
                symbol: "checkmark",
                title: done == 0 ? "Clear skies" : "All done",
                message: done == 0
                    ? "Nothing on your plate. Enjoy the quiet."
                    : "All done. You knocked out \(done) task\(done == 1 ? "" : "s") today."
            )
        } else {
            LazyVStack(spacing: Theme.grid * 1.5) {
                ForEach(model.listTodos) { todo in
                    NavigationLink(value: todo.id) {
                        TodoRow(
                            todo: todo,
                            onStart: model.timer.isActive ? nil : {
                                timerStarts += 1
                                model.start(id: todo.id)
                            },
                            onComplete: { Task { await model.complete(id: todo.id) } }
                        )
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button("Start timer", systemImage: "play.fill") {
                            timerStarts += 1
                            model.start(id: todo.id)
                        }
                        Button("Complete", systemImage: "checkmark") {
                            menuCompletions += 1
                            Task { await model.complete(id: todo.id) }
                        }
                        Button("Not today", systemImage: "moon") {
                            Task { await model.notToday(id: todo.id) }
                        }
                    }
                }
            }
            .animation(.easeOut(duration: 0.3), value: model.listTodos.map(\.id))

            if model.completedTodayCount > 0 {
                Text("\(model.completedTodayCount) done today")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.6))
                    .frame(maxWidth: .infinity)
                    .padding(.top, Theme.grid * 3)
            }
        }
    }

    /// "4 tasks · 2h 20m · done by ~7:01 PM", with Start until a timer is on the clock,
    /// and the overcommitment sentence underneath when the plan doesn't fit.
    private func daySummary(_ summary: TodayViewModel.Summary) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: Theme.grid * 1.5) {
                Text(summary.line)
                    .font(Theme.font(.subheadline))
                    .monospacedDigit()
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .layoutPriority(1)

                Spacer(minLength: 0)

                if !model.timer.isActive {
                    Button {
                        timerStarts += 1
                        model.startFirst()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "play.fill")
                                .font(.system(size: 9, weight: .bold))
                            Text("Start")
                                .font(Theme.font(.caption, weight: .medium))
                        }
                        .foregroundStyle(Theme.primary)
                        .padding(.horizontal, Theme.grid)
                        .frame(minHeight: 36)
                        .contentShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .fixedSize()
                    .accessibilityLabel("Start the first task")
                    .transition(.opacity)
                }
            }
            .frame(minHeight: 36)

            if let note = model.overcommitNote {
                Text(note)
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.8))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.leading, 4)
        .padding(.bottom, Theme.grid * 1.5)
        .animation(.easeOut(duration: 0.2), value: model.timer.isActive)
    }

    private var loadingState: some View {
        HStack {
            Spacer()
            ProgressView()
                .tint(Theme.onSurfaceVariant)
            Spacer()
        }
        .padding(.vertical, Theme.grid * 8)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Theme.grid * 2) {
            Text(message)
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.error)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await model.reload() }
            }
            .font(Theme.font(.subheadline, weight: .medium))
            .foregroundStyle(Theme.primary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.grid * 8)
    }
}

/// A flat event row: "9:00 AM  Dentist". Flat on purpose so it reads as reference, not a task.
private struct EventRow: View {
    let event: CalendarEvent

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.grid * 1.5) {
            Text(event.allDay ? "All day" : TimeMath.formatClock(event.startTime))
                .font(Theme.font(.footnote))
                .monospacedDigit()
                .foregroundStyle(Theme.onSurfaceVariant)
                .frame(width: 64, alignment: .leading)

            Text(title)
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurface)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .frame(minHeight: 40)
        .accessibilityElement(children: .combine)
    }

    private var title: String {
        if let location = event.location, !location.isEmpty {
            return "\(event.title) · \(location)"
        }
        return event.title
    }
}
