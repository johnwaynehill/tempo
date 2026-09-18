import SwiftUI
import TempoKit

/// Distinguishes a note push from the todo-detail push that `TabStack` already
/// registers `UUID.self` for on this same `NavigationStack` — a plain `UUID` item
/// binding would collide with that destination.
private struct NoteRoute: Hashable {
    let id: UUID
}

/// The notes list. Mirrors `Notes.tsx`: a title/count header, a "+" that creates an
/// "Untitled" note and jumps straight to its editor, and rows with title + last-edited
/// date (plus a small "linked" mark when a todo is attached). Notes aren't part of
/// `AppModel`/the offline write queue in this phase — this view owns its own list,
/// loaded straight from the client, with optimistic local updates on mutation (mirrors
/// how `MoodModel` manages its own small slice of state).
struct NotesListView: View {
    @Environment(Session.self) private var session

    @State private var notes: [Note] = []
    @State private var hasLoaded = false
    @State private var error: String?
    @State private var creating = false
    @State private var selectedNote: NoteRoute?

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d"
        return f
    }()

    private var sorted: [Note] {
        notes.sorted { $0.updatedAt > $1.updatedAt }
    }

    var body: some View {
        List {
            PageHeader(title: "Notes", subtitle: "\(notes.count) note\(notes.count == 1 ? "" : "s")")
                .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            if let error, hasLoaded {
                Text(error)
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.error)
                    .plainRow(bottom: Theme.grid)
            }

            if !hasLoaded {
                HStack { Spacer(); ProgressView().tint(Theme.onSurfaceVariant); Spacer() }
                    .plainRow(top: Theme.grid * 8)
            } else if sorted.isEmpty {
                EmptyState(symbol: "note.text", title: "No notes yet", message: "Create one with the + button above.")
                    .plainRow()
            } else {
                ForEach(sorted) { note in
                    row(note)
                }
            }
        }
        .tempoList()
        .navigationDestination(item: $selectedNote) { route in
            NoteEditorView(id: route.id, notes: $notes)
        }
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await createNote() }
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(creating)
                .accessibilityLabel("New note")
            }
        }
        // `onAppear` (not `.task`) so returning from the editor — where a title, content
        // or delete edit landed straight in the shared `notes` binding — still catches
        // this list up if it was ever out of sync, and the first appearance loads too.
        .onAppear { Task { await load() } }
        .refreshable { await load() }
    }

    private func row(_ note: Note) -> some View {
        Button {
            selectedNote = NoteRoute(id: note.id)
        } label: {
            HStack(alignment: .top, spacing: Theme.grid) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(note.title.isEmpty ? "Untitled" : note.title)
                        .font(Theme.display(.subheadline, weight: .semibold))
                        .foregroundStyle(Theme.onSurface)
                        .lineLimit(1)
                    HStack(spacing: Theme.grid) {
                        Text(Self.dateFormatter.string(from: note.updatedAt))
                            .font(Theme.font(.caption))
                            .foregroundStyle(Theme.onSurfaceVariant)
                        if note.linkedTodoId != nil {
                            Text("linked")
                                .font(Theme.font(.caption))
                                .foregroundStyle(Theme.primary.opacity(0.6))
                        }
                    }
                }
                Spacer(minLength: Theme.grid)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.4))
            }
            .padding(Theme.grid * 2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        }
        .buttonStyle(.plain)
        .cardRow()
    }

    private func load() async {
        guard let client = session.client else { hasLoaded = true; return }
        do {
            notes = try await client.notes()
            error = nil
        } catch {
            self.error = "Couldn't load notes. Pull to refresh to try again."
        }
        hasLoaded = true
    }

    private func createNote() async {
        guard !creating, let client = session.client else { return }
        creating = true
        defer { creating = false }
        do {
            let note = try await client.createNote(NoteDraft(title: "Untitled"))
            notes.append(note)
            selectedNote = NoteRoute(id: note.id)
        } catch {
            self.error = "Couldn't create a note. Try again."
        }
    }
}
