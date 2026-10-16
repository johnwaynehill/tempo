import SwiftUI
import TempoKit

/// Wrapped so these pushes don't collide with the `UUID` (todo detail) destination `TabStack` registers.
private struct ProjectRoute: Hashable { let id: UUID }
private struct ProjectNoteRoute: Hashable { let id: UUID }

/// Mirrors `Projects.tsx`: every project with its active todo and note counts, and a + that
/// names a new one. Projects go through the offline write queue like todos; notes don't live in
/// `AppModel`, so their counts come from one fetch and are simply left out when offline.
struct ProjectsView: View {
    @Environment(AppModel.self) private var model
    @Environment(Session.self) private var session

    @State private var notes: [Note] = []
    @State private var naming = false
    @State private var newName = ""
    @State private var opened: ProjectRoute?

    var body: some View {
        List {
            PageHeader(
                title: "Projects",
                subtitle: "\(model.projects.count) project\(model.projects.count == 1 ? "" : "s")"
            )
            .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            if !model.hasLoaded {
                HStack { Spacer(); ProgressView().tint(Theme.onSurfaceVariant); Spacer() }
                    .plainRow(top: Theme.grid * 8)
            } else if model.projects.isEmpty {
                EmptyState(
                    symbol: "folder",
                    title: "No projects yet",
                    message: "Create one with + above, or give a todo a project."
                )
                .plainRow()
            } else {
                ForEach(model.sortedProjects) { project in
                    row(project)
                }
            }
        }
        .tempoList()
        .animation(.easeOut(duration: 0.3), value: model.projects.map(\.id))
        .navigationDestination(item: $opened) { route in
            ProjectDetailView(projectId: route.id)
        }
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    newName = ""
                    naming = true
                } label: {
                    Image(systemName: "plus").foregroundStyle(Theme.onSurfaceVariant)
                }
                .accessibilityLabel("New project")
            }
        }
        .alert("New project", isPresented: $naming) {
            TextField("Project name", text: $newName)
                .textInputAutocapitalization(.words)
            Button("Cancel", role: .cancel) {}
            Button("Create") { create() }
        }
        .refreshable {
            await model.reload()
            await loadNotes()
        }
        .task { await model.loadIfNeeded() }
        .task { await loadNotes() }
    }

    private func row(_ project: Project) -> some View {
        let todoCount = model.todos.filter { $0.project == project.name && $0.status != .done }.count
        let noteCount = notes.filter { ($0.projects ?? []).contains(project.name) }.count
        var parts: [String] = []
        if todoCount > 0 { parts.append("\(todoCount) todo\(todoCount == 1 ? "" : "s")") }
        if noteCount > 0 { parts.append("\(noteCount) note\(noteCount == 1 ? "" : "s")") }

        return VStack(alignment: .leading, spacing: 4) {
            Text(project.name)
                .font(Theme.display(.subheadline, weight: .semibold))
                .foregroundStyle(Theme.onSurface)
            Text(parts.isEmpty ? "No active items" : parts.joined(separator: " · "))
                .font(Theme.font(.caption))
                .foregroundStyle(Theme.onSurfaceVariant)
        }
        .padding(Theme.grid * 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        .onTapGesture { opened = ProjectRoute(id: project.id) }
        .accessibilityAddTraits(.isButton)
        .cardRow()
    }

    private func create() {
        let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        Task {
            // An existing name just opens that project, as the server would hand it back.
            opened = ProjectRoute(id: await model.createProject(name: name))
        }
    }

    private func loadNotes() async {
        notes = await model.loadNotes(client: session.client).notes
    }
}

/// Mirrors `ProjectDetail.tsx`: the project's active todos with energy and sort filters, its
/// notes, a + that files a new todo here, and rename / delete.
struct ProjectDetailView: View {
    let projectId: UUID

    @Environment(AppModel.self) private var model
    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var sort: TodoSortMode = .priority
    @State private var energyFilter: EnergyLevel?
    @State private var showNew = false
    @State private var renaming = false
    @State private var renameValue = ""
    @State private var renameError: String?
    @State private var confirmingDelete = false
    @State private var notes: [Note] = []
    @State private var openedNote: ProjectNoteRoute?

    private var project: Project? { model.project(id: projectId) }
    private var name: String { project?.name ?? "" }

    /// Everything not done: Inbox, Backlog, Today and deferred alike.
    private var active: [Todo] {
        model.todos.filter { $0.project == name && $0.status != .done }
    }

    private var shown: [Todo] {
        let filtered = active.filter { energyFilter == nil || $0.energyLevel == energyFilter }
        return sort.apply(to: filtered, energy: model.preferences?.currentEnergy, calendar: model.calendar)
    }

    private var projectNotes: [Note] {
        notes.filter { ($0.projects ?? []).contains(name) }.sorted { $0.updatedAt > $1.updatedAt }
    }

    private var subtitle: String {
        var line = "\(active.count) active todo\(active.count == 1 ? "" : "s")"
        if !projectNotes.isEmpty { line += " · \(projectNotes.count) note\(projectNotes.count == 1 ? "" : "s")" }
        return line
    }

    var body: some View {
        List {
            PageHeader(title: name, subtitle: subtitle)
                .plainRow(top: Theme.grid, bottom: Theme.grid)

            filterBar
                .plainRow(bottom: Theme.grid * 2)

            if shown.isEmpty {
                EmptyState(
                    symbol: energyFilter == nil ? "folder" : "line.3.horizontal.decrease",
                    title: energyFilter == nil ? "Nothing active" : "Nothing matches",
                    message: energyFilter == nil
                        ? "No active tasks in this project. Add one with +."
                        : "No tasks at this energy level."
                )
                .plainRow()
            } else {
                ForEach(shown) { todo in
                    TodoRow(todo: todo, onComplete: { Task { await model.complete(id: todo.id) } })
                        .navigates(to: todo.id)
                        .cardRow()
                }
            }

            if !projectNotes.isEmpty {
                SectionLabel(text: "Notes", count: projectNotes.count)
                    .plainRow(top: Theme.grid * 3, bottom: Theme.grid)
                ForEach(projectNotes) { note in
                    noteRow(note)
                }
            }
        }
        .tempoList()
        .animation(.easeOut(duration: 0.3), value: shown.map(\.id))
        .navigationDestination(item: $openedNote) { route in
            NoteEditorView(id: route.id, notes: $notes)
        }
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showNew = true } label: {
                    Image(systemName: "plus").foregroundStyle(Theme.onSurfaceVariant)
                }
                .accessibilityLabel("New todo in this project")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Rename project", systemImage: "pencil") {
                        renameValue = name
                        renameError = nil
                        renaming = true
                    }
                    Button("Delete project", systemImage: "trash", role: .destructive) {
                        confirmingDelete = true
                    }
                } label: {
                    Image(systemName: "ellipsis").foregroundStyle(Theme.onSurfaceVariant)
                }
                .accessibilityLabel("Project actions")
            }
        }
        .sheet(isPresented: $showNew) {
            NewTodoSheet(status: .backlog, project: name, energy: energyFilter)
                .presentationDetents([.height(220)])
        }
        .alert("Rename project", isPresented: $renaming) {
            TextField("Project name", text: $renameValue)
                .textInputAutocapitalization(.words)
            Button("Cancel", role: .cancel) {}
            Button("Rename") { rename() }
        } message: {
            Text("Its todos move to the new name too.")
        }
        .alert("Couldn't rename", isPresented: Binding(get: { renameError != nil }, set: { if !$0 { renameError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(renameError ?? "")
        }
        .confirmationDialog("Delete \"\(name)\"?", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete project", role: .destructive) {
                Task {
                    await model.deleteProject(id: projectId)
                    dismiss()
                }
            }
        } message: {
            let total = model.todos.filter { $0.project == name }.count
            Text("This removes the \"\(name)\" label from \(total) todo\(total == 1 ? "" : "s"). The todos themselves won't be deleted.")
        }
        // Deleted elsewhere (or by the dialog above): nothing left to show.
        .onChange(of: project == nil) { _, gone in
            if gone { dismiss() }
        }
        .refreshable {
            await model.reload()
            await loadNotes()
        }
        .onAppear { Task { await loadNotes() } }
    }

    private var filterBar: some View {
        HStack(spacing: Theme.grid * 0.75) {
            Menu {
                Button("All levels") { energyFilter = nil }
                ForEach(EnergyLevel.allCases, id: \.self) { level in
                    Button(TodoRow.label(for: level)) { energyFilter = level }
                }
            } label: {
                FilterChip(title: energyFilter.map(TodoRow.label(for:)) ?? "Energy", isActive: energyFilter != nil)
            }
            Menu {
                ForEach(TodoSortMode.allCases) { mode in
                    Button {
                        sort = mode
                    } label: {
                        if sort == mode { Label(mode.rawValue, systemImage: "checkmark") } else { Text(mode.rawValue) }
                    }
                }
            } label: {
                FilterChip(title: sort == .priority ? "Sort" : sort.rawValue, isActive: sort != .priority)
            }
            Spacer(minLength: 0)
        }
    }

    private func noteRow(_ note: Note) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(note.title.isEmpty ? "Untitled" : note.title)
                .font(Theme.display(.subheadline, weight: .semibold))
                .foregroundStyle(Theme.onSurface)
                .lineLimit(1)
            Text(note.updatedAt.formatted(.dateTime.month(.abbreviated).day()))
                .font(Theme.font(.caption))
                .foregroundStyle(Theme.onSurfaceVariant)
        }
        .padding(Theme.grid * 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        .onTapGesture { openedNote = ProjectNoteRoute(id: note.id) }
        .accessibilityAddTraits(.isButton)
        .cardRow()
    }

    private func rename() {
        let newName = renameValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !newName.isEmpty, newName != name else { return }
        if let clash = model.project(named: newName), clash.id != projectId {
            renameError = "There's already a project called \"\(clash.name)\"."
            return
        }
        Task { await model.renameProject(id: projectId, to: newName) }
    }

    private func loadNotes() async {
        notes = await model.loadNotes(client: session.client).notes
    }
}
