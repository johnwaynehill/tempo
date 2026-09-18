import SwiftUI

/// The fifth tab: everything that doesn't fit Today/Inbox/Backlog/Habits. Mirrors the
/// web's sidebar items below the four bottom-nav pages.
struct MoreView: View {
    var body: some View {
        List {
            PageHeader(title: "More")
                .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            NavigationLink { PlanMyDayView() } label: {
                MoreRow(symbol: "sunrise", title: "Plan My Day")
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
        }
        .tempoList()
        .navigationTitle("")
        .toolbarTitleDisplayMode(.inline)
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
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.onSurfaceVariant.opacity(0.5))
        }
    }
}
