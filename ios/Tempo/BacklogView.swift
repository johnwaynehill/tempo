import SwiftUI
import TempoKit

/// Everything that isn't on Today or waiting in Inbox, best first. Mirrors the list
/// view of `Backlog.tsx`: sorted by `Scoring.scoreTodo` against the current energy,
/// grouped by project when there is more than one group.
struct BacklogView: View {
    @Environment(AppModel.self) private var model
    @State private var pendingDelete: Todo?

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

            if model.hasLoaded, !model.deferredLater.isEmpty {
                Section {
                    ForEach(model.deferredLater) { todo in
                        deferredRow(todo)
                    }
                } header: {
                    SectionLabel(text: "Deferred", count: model.deferredLater.count)
                        .padding(.horizontal, Theme.grid * 2 + 4)
                        .padding(.top, Theme.grid * 2)
                        .textCase(nil)
                }
                .listSectionSeparator(.hidden)
                .listSectionMargins(.vertical, 0)
            }
        }
        .tempoList()
        .confirmationDialog(
            "Delete \"\(pendingDelete?.title ?? "")\"?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                if let todo = pendingDelete { Task { await model.delete(id: todo.id) } }
                pendingDelete = nil
            }
        }
        .animation(.easeOut(duration: 0.3), value: backlog.map(\.id))
        .refreshable { await model.reload() }
        .toolbarTitleDisplayMode(.inline)
        .task { await model.loadIfNeeded() }
    }

    /// Out of sight until its date, but never out of reach: swipe to bring it back now.
    private func deferredRow(_ todo: Todo) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            TodoRow(todo: todo)
            if let until = todo.deferUntil {
                Text("Back \(until.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .padding(.leading, Theme.grid * 2)
            }
        }
        .navigates(to: todo.id)
        .cardRow()
        .opacity(0.75)
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button("Restore", systemImage: "arrow.uturn.backward") {
                Task { await model.restoreFromDefer(id: todo.id) }
            }
            .tint(Theme.primary)
        }
    }

    private func row(_ todo: Todo) -> some View {
        TodoRow(todo: todo, onComplete: { Task { await model.complete(id: todo.id) } })
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
                    pendingDelete = todo
                }
                .tint(Theme.error)
                Button("Defer", systemImage: "moon") {
                    Task { await model.defer(id: todo.id, until: DeferDates.tomorrow(calendar: model.calendar)) }
                }
                .tint(Theme.onSurfaceVariant)
            }
    }
}
