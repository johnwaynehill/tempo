import SwiftUI
import TempoKit

struct TodayView: View {
    @Environment(Session.self) private var session
    @State private var model: TodayViewModel?

    var body: some View {
        Group {
            if let model {
                TodayContent(model: model)
            } else {
                Theme.surface.ignoresSafeArea()
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    if let email = session.me?.email {
                        Text(email)
                    }
                    Button("Sign out", role: .destructive) { session.signOut() }
                } label: {
                    Image(systemName: "ellipsis")
                        .foregroundStyle(Theme.onSurfaceVariant)
                }
                .accessibilityLabel("Menu")
            }
        }
        .toolbarTitleDisplayMode(.inline)
        .task(id: session.apiKey) {
            guard let client = session.client else { return }
            let vm = TodayViewModel(client: client)
            model = vm
            await vm.loadIfNeeded()
        }
    }
}

private struct TodayContent: View {
    @Bindable var model: TodayViewModel

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "EEEE, MMM d"
        return f
    }()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.bottom, Theme.grid * 3)

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
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Today")
                .font(Theme.display(.largeTitle))
                .foregroundStyle(Theme.onSurface)
                .tracking(-0.5)
            Text(Self.dateFormatter.string(from: Date()))
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurfaceVariant)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Events

    private var eventsSection: some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            sectionLabel("Today's events")

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

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(Theme.font(size: 12, weight: .semibold))
            .tracking(1)
            .foregroundStyle(Theme.onSurfaceVariant)
    }

    // MARK: Tasks

    @ViewBuilder
    private var tasks: some View {
        if let summary = model.summary {
            Text(summary.line)
                .font(Theme.font(.subheadline))
                .monospacedDigit()
                .foregroundStyle(Theme.onSurfaceVariant)
                .lineLimit(1)
                .padding(.horizontal, 4)
                .padding(.bottom, Theme.grid * 1.5)
                .frame(minHeight: 36, alignment: .leading)
        }

        if model.todayTodos.isEmpty {
            emptyState
        } else {
            LazyVStack(spacing: Theme.grid * 1.5) {
                ForEach(model.todayTodos) { todo in
                    TodoRow(todo: todo)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: Theme.grid) {
            ZStack {
                Circle()
                    .fill(Theme.primary.opacity(0.1))
                    .frame(width: 48, height: 48)
                Image(systemName: "checkmark")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.primary)
            }
            .padding(.bottom, Theme.grid)
            Text("Clear skies")
                .font(Theme.display(.body, weight: .semibold))
                .foregroundStyle(Theme.onSurface)
            Text("Nothing on your plate. Enjoy the quiet.")
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurfaceVariant)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.grid * 10)
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
