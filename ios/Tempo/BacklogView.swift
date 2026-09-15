import SwiftUI
import TempoKit

/// Everything that isn't on Today or waiting in Inbox, best first. Mirrors the list
/// view of `Backlog.tsx`: sorted by `Scoring.scoreTodo` against the current energy,
/// grouped by project when there is more than one group.
struct BacklogView: View {
    @Environment(AppModel.self) private var model

    private var backlog: [Todo] { model.backlog }

    private var sorted: [Todo] {
        let energy = model.preferences?.currentEnergy
        let now = Date()
        let calendar = model.calendar
        return backlog
            .map { ($0, Scoring.scoreTodo($0, currentEnergy: energy, now: now, calendar: calendar)) }
            .sorted { $0.1 > $1.1 }
            .map(\.0)
    }

    private var groups: [(name: String, todos: [Todo])] {
        var map: [String: [Todo]] = [:]
        for todo in sorted {
            let key = (todo.project?.isEmpty == false) ? todo.project! : "Ungrouped"
            map[key, default: []].append(todo)
        }
        return map
            .map { (name: $0.key, todos: $0.value) }
            .sorted { a, b in
                if a.name == "Ungrouped" { return false }
                if b.name == "Ungrouped" { return true }
                return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
            }
    }

    var body: some View {
        List {
            PageHeader(title: "Backlog", subtitle: "\(backlog.count) total")
                .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            if let error = model.error, model.hasLoaded {
                Text(error)
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.error)
                    .plainRow(bottom: Theme.grid)
            }

            if !model.hasLoaded {
                HStack { Spacer(); ProgressView().tint(Theme.onSurfaceVariant); Spacer() }
                    .plainRow(top: Theme.grid * 8)
            } else if backlog.isEmpty {
                EmptyState(symbol: "list.bullet", title: "Backlog is empty", message: "Nothing queued up. Capture something in Inbox.")
                    .plainRow()
            } else if groups.count > 1 {
                ForEach(groups, id: \.name) { group in
                    Section {
                        ForEach(group.todos) { todo in
                            row(todo)
                        }
                    } header: {
                        SectionLabel(text: group.name, count: group.todos.count)
                            .padding(.horizontal, Theme.grid * 2 + 4)
                            .padding(.top, Theme.grid)
                            .textCase(nil)
                    }
                    .listSectionSeparator(.hidden)
                    .listSectionMargins(.vertical, 0)
                }
            } else {
                ForEach(sorted) { todo in
                    row(todo)
                }
            }
        }
        .tempoList()
        .animation(.easeOut(duration: 0.3), value: backlog.map(\.id))
        .refreshable { await model.reload() }
        .toolbarTitleDisplayMode(.inline)
        .task { await model.loadIfNeeded() }
    }

    private func row(_ todo: Todo) -> some View {
        TodoRow(todo: todo)
            .navigates(to: todo.id)
            .cardRow()
            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                Button("Today", systemImage: "circle.circle") {
                    Task { await model.pin(id: todo.id) }
                }
                .tint(Theme.primary)
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                Button("Delete", systemImage: "trash", role: .destructive) {
                    Task { await model.delete(id: todo.id) }
                }
                .tint(Theme.error)
                Button("Defer", systemImage: "moon") {
                    Task { await model.defer(id: todo.id, until: DeferDates.tomorrow(calendar: model.calendar)) }
                }
                .tint(Theme.onSurfaceVariant)
            }
    }
}
