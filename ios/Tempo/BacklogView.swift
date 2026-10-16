import SwiftUI
import TempoKit

/// Everything that isn't on Today or waiting in Inbox, best first. Mirrors the list
/// view of `Backlog.tsx`: sorted by `Scoring.scoreTodo` against the current energy,
/// grouped by project when there is more than one group.
struct BacklogView: View {
    @Environment(AppModel.self) private var model
    @State private var pendingDelete: Todo?
    @State private var sort: SortMode = .priority
    @State private var projectFilter: String?
    @State private var energyFilter: EnergyLevel?
    @State private var showNew = false

    /// `Backlog.tsx`'s three orders.
    enum SortMode: String, CaseIterable, Identifiable {
        case priority = "Priority", due = "Due date", recent = "Recent"
        var id: Self { self }
    }

    private var backlog: [Todo] { model.backlog }

    private var filtered: [Todo] {
        backlog.filter { todo in
            (energyFilter == nil || todo.energyLevel == energyFilter)
                && (projectFilter == nil || todo.project == projectFilter)
        }
    }

    private var activeFilterCount: Int { (projectFilter == nil ? 0 : 1) + (energyFilter == nil ? 0 : 1) }

    /// Projects that actually have something in the Backlog, with how many.
    private var projectCounts: [(name: String, count: Int)] {
        var counts: [String: Int] = [:]
        for todo in backlog {
            if let project = todo.project, !project.isEmpty { counts[project, default: 0] += 1 }
        }
        return counts.map { ($0.key, $0.value) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private var sorted: [Todo] {
        switch sort {
        case .priority:
            let energy = model.preferences?.currentEnergy
            let now = Date()
            let calendar = model.calendar
            return filtered
                .map { ($0, Scoring.scoreTodo($0, currentEnergy: energy, now: now, calendar: calendar)) }
                .sorted { $0.1 > $1.1 }
                .map(\.0)
        case .due:
            // Undated last, as on the web.
            return filtered.sorted { a, b in
                switch (a.dueDate, b.dueDate) {
                case let (x?, y?): x < y
                case (.some, nil): true
                default: false
                }
            }
        case .recent:
            return filtered.sorted { $0.createdAt > $1.createdAt }
        }
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
            PageHeader(
                title: "Backlog",
                subtitle: activeFilterCount == 0 ? "\(backlog.count) total" : "\(backlog.count) total · \(filtered.count) showing"
            )
            .plainRow(top: Theme.grid, bottom: Theme.grid)

            filterBar
                .plainRow(bottom: Theme.grid * 2)

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
            } else if filtered.isEmpty {
                EmptyState(symbol: "line.3.horizontal.decrease", title: "Nothing matches", message: "Try another project or energy level.")
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
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showNew = true } label: {
                    Image(systemName: "plus").foregroundStyle(Theme.onSurfaceVariant)
                }
                .accessibilityLabel("New todo")
            }
        }
        .sheet(isPresented: $showNew) {
            // A new todo inherits the filters you're looking through, as on the web.
            NewTodoSheet(status: .backlog, project: projectFilter, energy: energyFilter)
                .presentationDetents([.height(220)])
        }
        .toolbarTitleDisplayMode(.inline)
        .task { await model.loadIfNeeded() }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.grid * 0.75) {
                if !projectCounts.isEmpty {
                    Menu {
                        Button("All projects") { projectFilter = nil }
                        ForEach(projectCounts, id: \.name) { item in
                            Button("\(item.name) (\(item.count))") { projectFilter = item.name }
                        }
                    } label: {
                        FilterChip(title: projectFilter ?? "Project", isActive: projectFilter != nil)
                    }
                }
                Menu {
                    Button("All levels") { energyFilter = nil }
                    ForEach(EnergyLevel.allCases, id: \.self) { level in
                        Button(TodoRow.label(for: level)) { energyFilter = level }
                    }
                } label: {
                    FilterChip(title: energyFilter.map(TodoRow.label(for:)) ?? "Energy", isActive: energyFilter != nil)
                }
                Menu {
                    ForEach(SortMode.allCases) { mode in
                        Button {
                            sort = mode
                        } label: {
                            if sort == mode { Label(mode.rawValue, systemImage: "checkmark") } else { Text(mode.rawValue) }
                        }
                    }
                } label: {
                    FilterChip(title: sort == .priority ? "Sort" : sort.rawValue, isActive: sort != .priority)
                }
                if activeFilterCount > 0 {
                    Button {
                        projectFilter = nil
                        energyFilter = nil
                    } label: {
                        Label("Clear", systemImage: "xmark")
                            .font(Theme.font(.caption, weight: .medium))
                            .foregroundStyle(Theme.onSurfaceVariant)
                            .padding(.horizontal, Theme.grid)
                            .frame(minHeight: 32)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
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
