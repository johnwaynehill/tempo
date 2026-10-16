import SwiftUI

/// The fifth tab: everything that doesn't fit Today/Inbox/Backlog/Habits. Mirrors the
/// web's sidebar items below the four bottom-nav pages.
struct MoreView: View {
    @Environment(Session.self) private var session
    @Environment(AppModel.self) private var model
    @State private var confirmingSignOut = false

    var body: some View {
        List {
            PageHeader(title: "More")
                .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            NavigationLink { PlanMyDayView() } label: {
                MoreRow(symbol: "sunrise", title: "Plan My Day")
            }
            .cardRow()

            NavigationLink { BrainDumpView() } label: {
                MoreRow(symbol: "brain", title: "Brain Dump")
            }
            .cardRow()

            NavigationLink { CompletedView() } label: {
                MoreRow(symbol: "checkmark.circle", title: "Completed")
            }
            .cardRow()

            NavigationLink { ProjectsView() } label: {
                MoreRow(symbol: "folder", title: "Projects")
            }
            .cardRow()

            NavigationLink { PlaylistsView() } label: {
                MoreRow(symbol: "list.bullet.rectangle", title: "Playlists")
            }
            .cardRow()

            NavigationLink { NotesListView() } label: {
                MoreRow(symbol: "note.text", title: "Notes")
            }
            .cardRow()

            NavigationLink { InsightsView() } label: {
                MoreRow(symbol: "chart.bar", title: "Insights")
            }
            .cardRow()

            NavigationLink { WeeklyReviewView() } label: {
                MoreRow(symbol: "calendar", title: "Weekly Review")
            }
            .cardRow()

            NavigationLink { SettingsView() } label: {
                MoreRow(symbol: "gearshape", title: "Settings")
            }
            .cardRow()

            VStack(alignment: .leading, spacing: Theme.grid) {
                if let email = session.me?.email {
                    Text("Signed in as \(email)")
                        .font(Theme.font(.footnote))
                        .foregroundStyle(Theme.onSurfaceVariant)
                }
                Button("Sign out", role: .destructive) { confirmingSignOut = true }
                    .font(Theme.font(.subheadline, weight: .medium))
                    .buttonStyle(.borderless)
            }
            .plainRow(top: Theme.grid * 4, bottom: Theme.grid * 4)
        }
        .tempoList()
        .tabRootChrome()
        .confirmationDialog("Sign out of Tempo?", isPresented: $confirmingSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) {
                Task {
                    await model.signOut()
                    session.signOut()
                }
            }
        } message: {
            Text("Changes that haven't synced yet are lost.")
        }
    }
}

private struct MoreRow: View {
    var symbol: String
    var title: String

    var body: some View {
        HStack(spacing: Theme.grid * 1.5) {
            Image(systemName: symbol)
                .foregroundStyle(Theme.primary)
                .frame(width: 22)
            Text(title)
                .font(Theme.font(.subheadline, weight: .medium))
                .foregroundStyle(Theme.onSurface)
            Spacer()
        }
    }
}
