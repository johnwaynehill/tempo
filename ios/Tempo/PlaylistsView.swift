import SwiftUI
import TempoKit

/// A named, reusable sequence of steps that becomes pinned-to-Today todos with one tap.
/// Mirrors `Playlists.tsx`. Playlists aren't part of `AppModel`'s offline queue (edited
/// rarely), so this view keeps its own list, loaded fresh on appear and refetched after
/// each write.
struct PlaylistsView: View {
    @Environment(Session.self) private var session
    @Environment(AppModel.self) private var model

    @State private var playlists: [Playlist] = []
    @State private var isLoading = true
    @State private var loadError: String?

    @State private var showCreate = false
    @State private var newName = ""
    @State private var creating = false

    @State private var startingId: UUID?
    @State private var confirmation: String?

    @State private var selectedPlaylist: Playlist?

    var body: some View {
        List {
            PageHeader(title: "Playlists", subtitle: "Routine task sequences you can start with one tap")
                .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            if let confirmation {
                Text(confirmation)
                    .font(Theme.font(.footnote, weight: .medium))
                    .foregroundStyle(Theme.primary)
                    .transition(.opacity)
                    .plainRow(bottom: Theme.grid)
            }

            if let loadError, !isLoading {
                Text(loadError)
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.error)
                    .plainRow(bottom: Theme.grid)
            }

            if isLoading {
                HStack { Spacer(); ProgressView().tint(Theme.onSurfaceVariant); Spacer() }
                    .plainRow(top: Theme.grid * 8)
            } else if playlists.isEmpty {
                EmptyState(
                    symbol: "list.bullet.rectangle",
                    title: "No playlists yet",
                    message: "Create a routine to breeze through repetitive task sequences."
                )
                .plainRow()
            } else {
                ForEach(playlists) { playlist in
                    PlaylistRow(
                        playlist: playlist,
                        isStarting: startingId == playlist.id,
                        onOpen: { selectedPlaylist = playlist },
                        onStart: { Task { await start(playlist) } }
                    )
                    .cardRow()
                }
            }
        }
        .tempoList()
        .animation(.easeOut(duration: 0.3), value: confirmation)
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    newName = ""
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(Theme.onSurfaceVariant)
                }
                .accessibilityLabel("New playlist")
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .navigationDestination(item: $selectedPlaylist) { playlist in
            PlaylistDetailView(playlistId: playlist.id)
        }
        .onChange(of: selectedPlaylist) { oldValue, newValue in
            // Popped back from the detail screen: pick up any rename/reorder/delete.
            if oldValue != nil, newValue == nil {
                Task { await load() }
            }
        }
        .alert("New playlist", isPresented: $showCreate) {
            TextField("e.g., Morning routine", text: $newName)
            Button("Cancel", role: .cancel) {}
            Button("Create") { Task { await create() } }
                .disabled(newName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    // MARK: Actions

    private func load() async {
        guard let client = session.client else {
            isLoading = false
            loadError = "You're not signed in."
            return
        }
        do {
            playlists = try await client.playlists()
            loadError = nil
        } catch {
            loadError = "Couldn't load playlists. Pull to try again."
        }
        isLoading = false
    }

    private func create() async {
        guard let client = session.client, !creating else { return }
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        creating = true
        do {
            let created = try await client.createPlaylist(PlaylistDraft(name: trimmed))
            playlists.append(created)
            loadError = nil
            selectedPlaylist = created
        } catch {
            loadError = "Couldn't create that playlist. Try again."
        }
        creating = false
    }

    /// Pins the playlist's steps to Today. Deliberately does not switch tabs — that's
    /// `MainTabs`'s call — so this just confirms and lets the user tap over to Today.
    private func start(_ playlist: Playlist) async {
        guard let client = session.client, startingId == nil else { return }
        startingId = playlist.id
        confirmation = nil
        do {
            let result = try await client.startPlaylist(id: playlist.id)
            await model.reload()
            confirmation = "\(result.count) task\(result.count == 1 ? "" : "s") added to Today"
        } catch {
            loadError = "Couldn't start that playlist. Try again."
        }
        startingId = nil
    }
}

private struct PlaylistRow: View {
    let playlist: Playlist
    var isStarting: Bool
    var onOpen: () -> Void
    var onStart: () -> Void

    private var totalMinutes: Int { TimeMath.totalEstimatedMinutes(playlist.items) }

    var body: some View {
        HStack(spacing: Theme.grid * 2) {
            VStack(alignment: .leading, spacing: 2) {
                Text(playlist.name)
                    .font(Theme.font(.subheadline, weight: .medium))
                    .foregroundStyle(Theme.onSurface)
                    .lineLimit(1)
                Text("\(playlist.items.count) task\(playlist.items.count == 1 ? "" : "s") · \(TimeMath.formatMinutes(totalMinutes))")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .monospacedDigit()
            }
            Spacer(minLength: Theme.grid)
            Button(action: onStart) {
                Text(isStarting ? "Starting…" : "Start")
            }
            .buttonStyle(SecondaryButtonStyle())
            .disabled(isStarting || playlist.items.isEmpty)
        }
        .padding(Theme.grid * 2)
        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        .contentShape(Rectangle())
        // An invisible control behind the row content, so tapping the name/estimate
        // opens the playlist while the foreground Start button keeps its own hit area.
        .background(
            Button(action: onOpen) { Color.clear }
                .buttonStyle(.plain)
                .accessibilityHidden(true)
        )
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: "Open") { onOpen() }
    }
}
