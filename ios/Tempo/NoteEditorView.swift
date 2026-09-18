import SwiftUI
import TempoKit

/// One note, editable in place. Mirrors `NoteEditor.tsx`: title, last-edited date,
/// hashtag-derived project chips, the linked todo, a Markdown editor, and delete with
/// confirmation.
///
/// Two deliberate scope reductions versus the web, not oversights:
/// - The web uses a WYSIWYG Markdown editor (Milkdown). SwiftUI has no equivalent, so
///   this edits the raw Markdown source in a plain `TextEditor`.
/// - Inline checkbox-to-todo linking (tapping a `- [ ]` in the editor to create/toggle
///   a todo) depends on that WYSIWYG checkbox rendering, so it isn't ported either.
///
/// Notes aren't part of `AppModel`/the offline write queue in this phase, so this view
/// (and `NotesListView`, which owns the list) talk to the client directly and update
/// the shared `notes` binding optimistically after each mutation.
struct NoteEditorView: View {
    @Environment(Session.self) private var session
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    let id: UUID
    @Binding var notes: [Note]

    @State private var title = ""
    @State private var content = ""
    @State private var seededFor: UUID?
    @State private var lastProjects: [String] = []
    @State private var titleSave: Task<Void, Never>?
    @State private var contentSave: Task<Void, Never>?
    @State private var confirmDelete = false
    @State private var showTodoPicker = false
    @State private var deleting = false
    @State private var errorMessage: String?
    @FocusState private var titleFocused: Bool

    private static let editedFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d, h:mm a"
        return f
    }()

    private var note: Note? { notes.first { $0.id == id } }

    var body: some View {
        Group {
            if let note {
                content(note)
            } else {
                EmptyState(symbol: "note.text", title: "Note not found", message: "It may have been deleted.")
                    .frame(maxHeight: .infinity, alignment: .top)
                    .padding(.horizontal, Theme.grid * 2)
            }
        }
        .background(Theme.surface.ignoresSafeArea())
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if note != nil {
                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        Image(systemName: "trash")
                    }
                    .disabled(deleting)
                    .accessibilityLabel("Delete note")
                }
            }
        }
        .confirmationDialog("Delete this note?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { await performDelete() }
            }
        } message: {
            Text("This can't be undone.")
        }
        .sheet(isPresented: $showTodoPicker) {
            TodoLinkPickerSheet(
                candidates: model.todos.filter { $0.status != .done && $0.noteId == nil },
                onSelect: { todoId in Task { await link(todoId: todoId) } },
                onCreate: { newTitle in Task { await createAndLink(title: newTitle) } }
            )
        }
        .onChange(of: note?.id, initial: true) { _, _ in seedIfNeeded() }
        .onDisappear {
            flushTitle()
            flushContent()
        }
    }

    // MARK: Content

    private func content(_ note: Note) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.grid * 2) {
                TextField("Untitled", text: $title, axis: .vertical)
                    .font(Theme.display(.title2))
                    .foregroundStyle(Theme.onSurface)
                    .tracking(-0.5)
                    .focused($titleFocused)
                    .submitLabel(.done)
                    .onChange(of: title) { _, _ in scheduleTitleSave() }
                    .onSubmit { flushTitle(); titleFocused = false }

                Text("Last edited \(Self.editedFormatter.string(from: note.updatedAt))")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)

                if let errorMessage {
                    Text(errorMessage)
                        .font(Theme.font(.footnote))
                        .foregroundStyle(Theme.error)
                }

                FlowLayout(spacing: Theme.grid) {
                    ForEach(note.projects ?? [], id: \.self) { project in
                        Chip(text: "#\(project)", background: Theme.primaryContainer, foreground: Theme.onSurface)
                    }
                    linkedTodoView(note)
                }

                Divider().overlay(Theme.outlineVariant.opacity(0.3))

                TextEditor(text: $content)
                    .font(Theme.font(.body))
                    .foregroundStyle(Theme.onSurface)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 320)
                    .onChange(of: content) { _, _ in scheduleContentSave() }
            }
            .padding(.horizontal, Theme.grid * 2)
            .padding(.top, Theme.grid)
            .padding(.bottom, Theme.grid * 4)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    /// Read-only when set (the web itself has no unlink control here either) — a "+
    /// Link Todo" chip opens the picker sheet when nothing is linked yet.
    @ViewBuilder
    private func linkedTodoView(_ note: Note) -> some View {
        if let linkedId = note.linkedTodoId, let todo = model.todo(id: linkedId) {
            HStack(spacing: 6) {
                Circle()
                    .strokeBorder(todo.status == .done ? Color.clear : Theme.outlineVariant, lineWidth: 1.5)
                    .background(Circle().fill(todo.status == .done ? Theme.primary : .clear))
                    .frame(width: 8, height: 8)
                Text(todo.title)
                    .font(Theme.font(.caption, weight: .medium))
                    .strikethrough(todo.status == .done)
                    .lineLimit(1)
            }
            .foregroundStyle(todo.status == .done ? Theme.primary : Theme.onSurfaceVariant)
            .padding(.vertical, 6)
            .padding(.horizontal, Theme.grid * 1.5)
            .background(
                todo.status == .done ? Theme.primary.opacity(0.1) : Theme.surfaceContainerHigh,
                in: RoundedRectangle(cornerRadius: 8, style: .continuous)
            )
        } else {
            Button {
                showTodoPicker = true
            } label: {
                Text("+ Link Todo")
                    .font(Theme.font(.caption, weight: .medium))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .padding(.vertical, 6)
                    .padding(.horizontal, Theme.grid * 1.5)
                    .background(Theme.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: Saving

    private func seedIfNeeded() {
        guard let note, seededFor != note.id else { return }
        seededFor = note.id
        title = note.title
        content = note.content
        lastProjects = note.projects ?? []
    }

    private func scheduleTitleSave() {
        titleSave?.cancel()
        titleSave = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            flushTitle()
        }
    }

    private func scheduleContentSave() {
        contentSave?.cancel()
        contentSave = Task {
            try? await Task.sleep(for: .milliseconds(800))
            guard !Task.isCancelled else { return }
            flushContent()
        }
    }

    private func flushTitle() {
        titleSave?.cancel()
        titleSave = nil
        guard let note else { return }
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        // Mirrors the web: an emptied title never saves — just reverts visually, since
        // this is a controlled field rather than the web's uncontrolled `defaultValue`.
        guard !trimmed.isEmpty else { title = note.title; return }
        guard trimmed != note.title else { return }
        save(NotePatch(title: .set(trimmed)))
    }

    /// Debounced ~800ms after the last keystroke, like the web. Recomputes hashtags and
    /// only includes `projects` in the patch when they've changed since the last save.
    private func flushContent() {
        contentSave?.cancel()
        contentSave = nil
        guard let note else { return }
        // `content` is also set programmatically in `seedIfNeeded()`, which fires this
        // same `.onChange` as a real keystroke would — without this guard, just opening
        // a note re-saves it 800ms later (bumping `updatedAt` and reordering the list).
        guard content != note.content else { return }
        let tags = Self.extractHashtags(from: content)
        var patch = NotePatch(content: .set(content))
        if tags != lastProjects {
            patch.projects = tags
            lastProjects = tags
        }
        save(patch)
    }

    private func save(_ patch: NotePatch) {
        Task {
            guard let client = session.client, let idx = notes.firstIndex(where: { $0.id == id }) else { return }
            do {
                let updated = try await client.updateNote(id: id, patch)
                notes[idx] = updated
                errorMessage = nil
            } catch {
                errorMessage = "Couldn't save. Check your connection."
            }
        }
    }

    private func performDelete() async {
        guard !deleting, let client = session.client else { return }
        deleting = true
        do {
            try await client.deleteNote(id: id)
            notes.removeAll { $0.id == id }
            dismiss()
        } catch {
            errorMessage = "Couldn't delete. Try again."
        }
        deleting = false
    }

    private func link(todoId: UUID) async {
        showTodoPicker = false
        guard let client = session.client, let idx = notes.firstIndex(where: { $0.id == id }) else { return }
        do {
            let updated = try await client.updateNote(id: id, NotePatch(linkedTodoId: .set(todoId)))
            notes[idx] = updated
            await model.update(todo: todoId, patch: TodoPatch(noteId: .set(id)))
        } catch {
            errorMessage = "Couldn't link that todo."
        }
    }

    private func createAndLink(title newTitle: String) async {
        showTodoPicker = false
        let trimmed = newTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let created = await model.createTodo(title: trimmed.isEmpty ? (note?.title ?? "Untitled") : trimmed) else { return }
        await link(todoId: created.id)
    }

    // MARK: Hashtags
    // Ports `src/lib/hashtags.ts` verbatim. UI-adjacent glue kept local rather than in
    // TempoKit, per the phase-4 brief — small enough not to need its own test target.

    private static let hashtagRegex: NSRegularExpression = {
        let pattern = #"(?:^|[\s(])\\?#(\w[\w-]*)(?=[\s.,;:!?)}\]]|$)|(?:^|[\s(])\\?#\[([^\]]+)\]"#
        return try! NSRegularExpression(pattern: pattern, options: [.anchorsMatchLines])
    }()
    private static let fencedCodeRegex = try! NSRegularExpression(pattern: "```[\\s\\S]*?```")
    private static let inlineCodeRegex = try! NSRegularExpression(pattern: "`[^`]+`")

    static func extractHashtags(from markdown: String) -> [String] {
        var stripped = fencedCodeRegex.stringByReplacingMatches(
            in: markdown, range: NSRange(markdown.startIndex..., in: markdown), withTemplate: ""
        )
        stripped = inlineCodeRegex.stringByReplacingMatches(
            in: stripped, range: NSRange(stripped.startIndex..., in: stripped), withTemplate: ""
        )

        var tags: [String] = []
        let full = NSRange(stripped.startIndex..., in: stripped)
        hashtagRegex.enumerateMatches(in: stripped, range: full) { match, _, _ in
            guard let match else { return }
            let nameRange = match.range(at: 1).location != NSNotFound ? match.range(at: 1) : match.range(at: 2)
            guard nameRange.location != NSNotFound, let range = Range(nameRange, in: stripped) else { return }
            let tag = stripped[range].trimmingCharacters(in: .whitespacesAndNewlines)
            if !tag.isEmpty, !tags.contains(tag) { tags.append(tag) }
        }
        return tags
    }
}

/// Search-and-select sheet for linking a todo, mirroring `LinkPicker.tsx`: a search
/// field, a "+ New todo" row seeded with the query, then the filtered candidates.
private struct TodoLinkPickerSheet: View {
    var candidates: [Todo]
    var onSelect: (UUID) -> Void
    var onCreate: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @FocusState private var searchFocused: Bool

    private var filtered: [Todo] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return candidates }
        return candidates.filter { $0.title.localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        VStack(spacing: 0) {
            TextField("Search todos...", text: $query)
                .font(Theme.font(.subheadline))
                .focused($searchFocused)
                .padding(.horizontal, Theme.grid * 2)
                .padding(.vertical, 12)
                .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding(Theme.grid * 2)

            ScrollView {
                let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
                VStack(alignment: .leading, spacing: 2) {
                    Button {
                        onCreate(trimmed)
                        dismiss()
                    } label: {
                        HStack(spacing: 6) {
                            Text("+").foregroundStyle(Theme.primary)
                            Text("New todo\(trimmed.isEmpty ? "" : ": \(trimmed)")")
                                .foregroundStyle(Theme.primary)
                                .fontWeight(.medium)
                        }
                        .font(Theme.font(.subheadline))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, Theme.grid)
                        .padding(.horizontal, Theme.grid * 2)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    ForEach(filtered) { todo in
                        Button {
                            onSelect(todo.id)
                            dismiss()
                        } label: {
                            Text(todo.title)
                                .font(Theme.font(.subheadline))
                                .foregroundStyle(Theme.onSurface)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, Theme.grid)
                                .padding(.horizontal, Theme.grid * 2)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }

                    if filtered.isEmpty && !trimmed.isEmpty {
                        Text("No matches")
                            .font(Theme.font(.caption))
                            .foregroundStyle(Theme.onSurfaceVariant)
                            .padding(.horizontal, Theme.grid * 2)
                            .padding(.vertical, Theme.grid)
                    }
                }
                .padding(.bottom, Theme.grid * 2)
            }
        }
        .background(Theme.surface.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Theme.surface)
        .onAppear { searchFocused = true }
    }
}
