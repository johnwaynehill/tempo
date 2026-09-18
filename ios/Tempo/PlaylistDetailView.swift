import SwiftUI
import TempoKit

/// One playlist, editable in place. Mirrors `PlaylistDetailPage.tsx`: a name field, its
/// steps, an add-a-step field, and Save/Delete. Reordering and removing steps use native
/// `List` edit mode (`.onMove`/`.onDelete`) rather than the web's up/down arrow buttons —
/// simpler and more native-feeling here.
struct PlaylistDetailView: View {
    let playlistId: UUID

    @Environment(Session.self) private var session
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var playlist: Playlist?
    @State private var isLoading = true
    @State private var loadError: String?

    @State private var name = ""
    @State private var items: [PlaylistItem] = []
    @State private var newStepTitle = ""

    @State private var dirty = false
    @State private var saving = false
    @State private var confirmDelete = false
    @State private var deleting = false

    @State private var starting: StartKind?
    @State private var confirmation: String?

    private enum StartKind { case today, focus }

    private var totalMinutes: Int { TimeMath.totalEstimatedMinutes(items) }

    var body: some View {
        Group {
            if isLoading {
                HStack { Spacer(); ProgressView().tint(Theme.onSurfaceVariant); Spacer() }
                    .padding(.top, Theme.grid * 8)
                    .frame(maxHeight: .infinity, alignment: .top)
            } else if playlist == nil {
                EmptyState(symbol: "questionmark", title: "Playlist not found", message: "It may have been deleted.")
                    .frame(maxHeight: .infinity, alignment: .top)
                    .padding(.horizontal, Theme.grid * 2)
            } else {
                content
            }
        }
        .background(Theme.surface.ignoresSafeArea())
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            if playlist != nil {
                ToolbarItem(placement: .topBarTrailing) { EditButton() }
            }
        }
        .confirmationDialog("Delete this playlist?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { Task { await delete() } }
        }
        .task { await load() }
    }

    // MARK: Content

    private var content: some View {
        List {
            header
                .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            ForEach(items) { item in
                itemRow(item)
            }
            .onMove { indices, offset in
                items.move(fromOffsets: indices, toOffset: offset)
                dirty = true
            }
            .onDelete { offsets in
                items.remove(atOffsets: offsets)
                dirty = true
            }

            addStepRow
                .plainRow(top: Theme.grid, bottom: Theme.grid * 2)
        }
        .tempoList()
        .animation(.easeOut(duration: 0.3), value: confirmation)
        .refreshable { await load() }
        .safeAreaInset(edge: .bottom) { bottomBar }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            TextField("Playlist name", text: $name)
                .font(Theme.display(.title2, weight: .bold))
                .foregroundStyle(Theme.onSurface)
                .onChange(of: name) { _, _ in dirty = true }

            Text("\(items.count) task\(items.count == 1 ? "" : "s") · \(TimeMath.formatMinutes(totalMinutes))")
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurfaceVariant)
                .monospacedDigit()

            HStack(spacing: Theme.grid) {
                Button {
                    Task { await start() }
                } label: {
                    Text(starting == .today ? "Starting…" : "Start")
                }
                .buttonStyle(SecondaryButtonStyle())
                .disabled(starting != nil || items.isEmpty)

                Button {
                    Task { await startAndFocus() }
                } label: {
                    Text(starting == .focus ? "Starting…" : "Start & focus")
                }
                .buttonStyle(BarPrimaryButtonStyle())
                .disabled(starting != nil || items.isEmpty)
            }
            .padding(.top, Theme.grid)

            if let confirmation {
                Text(confirmation)
                    .font(Theme.font(.footnote, weight: .medium))
                    .foregroundStyle(Theme.primary)
                    .transition(.opacity)
            }

            if let loadError {
                Text(loadError)
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.error)
            }
        }
    }

    private func itemRow(_ item: PlaylistItem) -> some View {
        HStack(spacing: Theme.grid * 1.5) {
            Text(item.title)
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurface)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: Theme.grid)
            Text(TimeMath.formatMinutes(TimeMath.getEstimate(item)))
                .font(Theme.font(.caption))
                .foregroundStyle(Theme.onSurfaceVariant)
                .monospacedDigit()
        }
        .padding(.horizontal, Theme.grid * 2)
        .frame(minHeight: 44)
        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .cardRow()
    }

    private var addStepRow: some View {
        HStack(spacing: Theme.grid) {
            TextField("Add a step…", text: $newStepTitle)
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurface)
                .submitLabel(.done)
                .onSubmit(addStep)
                .padding(.horizontal, Theme.grid * 2)
                .frame(minHeight: 44)
                .background(Theme.surfaceContainer, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            Button(action: addStep) {
                Image(systemName: "plus")
                    .font(.system(size: 14, weight: .semibold))
            }
            .buttonStyle(SecondaryButtonStyle())
            .disabled(newStepTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    @ViewBuilder
    private var bottomBar: some View {
        HStack(spacing: Theme.grid * 2) {
            Button(role: .destructive) {
                confirmDelete = true
            } label: {
                Text("Delete playlist")
                    .font(Theme.font(.subheadline))
            }
            .tint(Theme.error)
            .disabled(deleting)

            Spacer(minLength: Theme.grid)

            if dirty {
                Button {
                    Task { await save() }
                } label: {
                    Text(saving ? "Saving…" : "Save changes")
                }
                .buttonStyle(BarPrimaryButtonStyle())
                .frame(maxWidth: 180)
                .disabled(saving || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(.horizontal, Theme.grid * 2)
        .padding(.vertical, Theme.grid * 1.5)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .background(Theme.surface.opacity(0.9))
    }

    // MARK: Actions

    private func addStep() {
        let title = newStepTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        items.append(PlaylistItem(playlistId: playlistId, title: title, sortOrder: items.count, estimatedMinutes: 15))
        newStepTitle = ""
        dirty = true
    }

    private func load() async {
        guard let client = session.client else {
            isLoading = false
            loadError = "You're not signed in."
            return
        }
        do {
            let found = try await client.playlists().first { $0.id == playlistId }
            playlist = found
            if let found, !dirty {
                name = found.name
                items = found.items
            }
            loadError = nil
        } catch {
            loadError = "Couldn't load this playlist. Pull to try again."
        }
        isLoading = false
    }

    private func save() async {
        guard let client = session.client, !saving else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        saving = true
        do {
            let updated = try await client.updatePlaylist(
                id: playlistId,
                PlaylistUpdate(name: trimmed, items: items.map(PlaylistItemDraft.init))
            )
            playlist = updated
            name = updated.name
            items = updated.items
            dirty = false
            loadError = nil
        } catch {
            loadError = "Couldn't save your changes. Try again."
        }
        saving = false
    }

    private func delete() async {
        guard let client = session.client, !deleting else { return }
        deleting = true
        do {
            try await client.deletePlaylist(id: playlistId)
            dismiss()
        } catch {
            loadError = "Couldn't delete this playlist. Try again."
            deleting = false
        }
    }

    /// Pins the steps to Today. Deliberately does not switch tabs itself (`MainTabs` owns
    /// that); this just confirms so the user can tap over to Today.
    private func start() async {
        guard let client = session.client, starting == nil else { return }
        starting = .today
        confirmation = nil
        do {
            let result = try await client.startPlaylist(id: playlistId)
            await model.reload()
            confirmation = "\(result.count) task\(result.count == 1 ? "" : "s") added to Today"
        } catch {
            loadError = "Couldn't start that playlist. Try again."
        }
        starting = nil
    }

    /// Pins the steps, then asks `AppModel` to present Focus Mode — the same
    /// `focusRequested` flag the Start-focus App Intent and widget use, which `MainTabs`
    /// and `TodayView` already watch to switch to Today and present the full-screen cover.
    private func startAndFocus() async {
        guard let client = session.client, starting == nil else { return }
        starting = .focus
        confirmation = nil
        do {
            _ = try await client.startPlaylist(id: playlistId)
            await model.reload()
            model.focusRequested = true
        } catch {
            loadError = "Couldn't start that playlist. Try again."
        }
        starting = nil
    }
}
