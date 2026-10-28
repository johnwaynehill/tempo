import SwiftUI
import TempoKit

/// What you've finished, newest first, grouped by day. Mirrors `Completed.tsx`: a period filter,
/// day headers ("Today", "Yesterday", "Tue, Oct 13"), and Undo on every row, which sends the
/// todo back to the Backlog.
struct CompletedView: View {
    @Environment(AppModel.self) private var model
    @State private var period: Period = .today

    enum Period: String, CaseIterable, Identifiable {
        case today = "Today", week = "This Week", month = "This Month", all = "All Time"
        var id: Self { self }
    }

    private var start: Date? {
        let calendar = model.calendar
        let today = calendar.startOfDay(for: Date())
        switch period {
        case .today: return today
        case .week: return Insights.startOfWeek(today, calendar: calendar)
        case .month: return calendar.dateInterval(of: .month, for: today)?.start
        case .all: return nil
        }
    }

    private var completed: [Todo] {
        model.todos
            .filter { $0.status == .done }
            .filter { todo in
                guard let start else { return true }
                return (todo.completedAt ?? .distantPast) >= start
            }
            .sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }
    }

    private var days: [(day: Date, todos: [Todo])] {
        let calendar = model.calendar
        var order: [Date] = []
        var byDay: [Date: [Todo]] = [:]
        for todo in completed {
            let day = calendar.startOfDay(for: todo.completedAt ?? .distantPast)
            if byDay[day] == nil { order.append(day) }
            byDay[day, default: []].append(todo)
        }
        return order.map { ($0, byDay[$0] ?? []) }
    }

    var body: some View {
        List {
            PageHeader(title: "Completed", subtitle: "\(completed.count) \(completed.count == 1 ? "task" : "tasks")")
                .plainRow(top: Theme.grid, bottom: Theme.grid)

            HStack(spacing: Theme.grid * 0.75) {
                ForEach(Period.allCases) { option in
                    PillButton(title: option.rawValue, isSelected: period == option) { period = option }
                }
            }
            .plainRow(bottom: Theme.grid * 2)

            if !model.hasLoaded {
                HStack { Spacer(); ProgressView().tint(Theme.onSurfaceVariant); Spacer() }
                    .plainRow(top: Theme.grid * 8)
            } else if completed.isEmpty {
                EmptyState(
                    symbol: "checkmark",
                    title: period == .today ? "Nothing yet today" : "Nothing in this period",
                    message: period == .today ? "Finished tasks land here." : "Try a longer range."
                )
                .plainRow()
            } else {
                ForEach(days, id: \.day) { group in
                    Section {
                        ForEach(group.todos) { todo in
                            CompletedRow(todo: todo, details: details(todo)) {
                                Task { await model.uncomplete(id: todo.id) }
                            }
                            .navigates(to: todo.id)
                            .cardRow()
                        }
                    } header: {
                        SectionLabel(text: dayLabel(group.day), count: group.todos.count)
                            .padding(.horizontal, Theme.grid * 2 + 4)
                            .padding(.top, Theme.grid)
                            .textCase(nil)
                    }
                    .listSectionSeparator(.hidden)
                    .listSectionMargins(.vertical, 0)
                }
            }
        }
        .tempoList()
        .animation(.easeOut(duration: 0.3), value: completed.map(\.id))
        .refreshable { await model.reload() }
        .toolbarTitleDisplayMode(.inline)
        .task { await model.loadIfNeeded() }
    }

    private func dayLabel(_ day: Date) -> String {
        Self.dayLabel(day, calendar: model.calendar)
    }

    /// "Today", "Yesterday", or a short day like "Tue, Oct 13".
    static func dayLabel(_ day: Date, calendar: Calendar) -> String {
        if calendar.isDateInToday(day) { return "Today" }
        if calendar.isDateInYesterday(day) { return "Yesterday" }
        return day.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    /// Under each row: the time it was finished (the day is in the section header) and its project.
    private func details(_ todo: Todo) -> [String] {
        var parts: [String] = []
        if let completed = todo.completedAt { parts.append(completed.formatted(date: .omitted, time: .shortened)) }
        if let project = todo.project, !project.isEmpty { parts.append(project) }
        return parts
    }
}

/// A finished task: filled check, struck-through title, a quiet details line, and Undo.
struct CompletedRow: View {
    let todo: Todo
    /// Shown under the title, e.g. when it was finished and its project.
    var details: [String] = []
    var onUndo: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Theme.grid * 1.5) {
            ZStack {
                Circle().fill(Theme.primary.opacity(0.2))
                Image(systemName: "checkmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Theme.primary)
            }
            .frame(width: 18, height: 18)
            .padding(.top, 2)

            VStack(alignment: .leading, spacing: 2) {
                Text(todo.title.isEmpty ? "Untitled" : todo.title)
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurface.opacity(0.6))
                    .strikethrough(true, color: Theme.onSurfaceVariant)
                    .lineLimit(2)
                HStack(spacing: Theme.grid) {
                    ForEach(details, id: \.self) { Text($0) }
                }
                .font(Theme.font(.caption))
                .foregroundStyle(Theme.onSurfaceVariant.opacity(0.7))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button("Undo", action: onUndo)
                .font(Theme.font(.caption, weight: .medium))
                .foregroundStyle(Theme.onSurfaceVariant)
                .padding(.horizontal, Theme.grid * 1.5)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
                .buttonStyle(.plain)
                .accessibilityLabel("Mark \(todo.title) not done")
        }
        .padding(.vertical, Theme.grid * 1.5)
        .padding(.horizontal, Theme.grid * 2)
        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }
}
