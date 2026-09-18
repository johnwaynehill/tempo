import AuthenticationServices
import SwiftUI
import TempoKit

/// Account + Google Calendar connect. The web equivalent (`Settings.tsx`) also hosts API
/// key management and appearance options; those stay web-only for now — this screen is
/// just enough for the one Phase 4 item that needs a native flow (OAuth) plus sign out.
struct SettingsView: View {
    @Environment(Session.self) private var session
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuthSession

    @State private var status: GoogleCalendarStatus?
    @State private var isLoading = true
    @State private var isConnecting = false
    @State private var isSyncing = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            PageHeader(title: "Settings")
                .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            if let me = session.me {
                SectionLabel(text: "Account")
                VStack(alignment: .leading, spacing: 4) {
                    Text(me.displayName ?? me.email ?? "Signed in")
                        .font(Theme.font(.subheadline, weight: .medium))
                        .foregroundStyle(Theme.onSurface)
                    if let email = me.email, me.displayName != nil {
                        Text(email)
                            .font(Theme.font(.footnote))
                            .foregroundStyle(Theme.onSurfaceVariant)
                    }
                }
                .cardRow()
            }

            SectionLabel(text: "Google Calendar")
            googleCalendarCard
                .cardRow()

            if let errorMessage {
                Text(errorMessage)
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.error)
                    .plainRow(top: Theme.grid)
            }

            Button("Sign out", role: .destructive) {
                Task {
                    await model.signOut()
                    session.signOut()
                }
            }
            .font(Theme.font(.subheadline, weight: .medium))
            .plainRow(top: Theme.grid * 3)
        }
        .tempoList()
        .task { await refreshStatus() }
    }

    @ViewBuilder
    private var googleCalendarCard: some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            if isLoading {
                HStack { Spacer(); ProgressView().tint(Theme.onSurfaceVariant); Spacer() }
            } else if let status, status.connected {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Connected")
                        .font(Theme.font(.subheadline, weight: .medium))
                        .foregroundStyle(Theme.onSurface)
                    if let email = status.email {
                        Text(email)
                            .font(Theme.font(.footnote))
                            .foregroundStyle(Theme.onSurfaceVariant)
                    }
                    if let error = status.lastSyncError {
                        Text(error)
                            .font(Theme.font(.footnote))
                            .foregroundStyle(Theme.error)
                    }
                }
                HStack(spacing: Theme.grid) {
                    Button(isSyncing ? "Syncing…" : "Sync now") { Task { await sync() } }
                        .buttonStyle(SecondaryButtonStyle())
                        .disabled(isSyncing)
                    Button("Disconnect", role: .destructive) { Task { await disconnect() } }
                        .buttonStyle(SecondaryButtonStyle())
                }
            } else {
                Text("Connect your Google Calendar so events show up on Today and count toward your day's availability.")
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.onSurfaceVariant)
                Button(isConnecting ? "Connecting…" : "Connect Google Calendar") { Task { await connect() } }
                    .buttonStyle(BarPrimaryButtonStyle())
                    .disabled(isConnecting)
            }
        }
    }

    private func refreshStatus() async {
        guard let client = session.client else { return }
        isLoading = true
        defer { isLoading = false }
        status = try? await client.googleCalendarStatus()
    }

    private func connect() async {
        guard let client = session.client else { return }
        errorMessage = nil
        isConnecting = true
        defer { isConnecting = false }
        do {
            let url = try await client.googleCalendarConnectURL()
            _ = try await webAuthSession.authenticate(using: url, callbackURLScheme: "tempo")
            await refreshStatus()
        } catch is CancellationError {
            // User dismissed the sheet — not an error worth surfacing.
        } catch let authError as ASWebAuthenticationSessionError where authError.code == .canceledLogin {
            // Same dismissal, thrown as an NSError instead on some OS versions.
        } catch {
            errorMessage = "Couldn't connect Google Calendar. Try again."
        }
    }

    private func disconnect() async {
        guard let client = session.client else { return }
        errorMessage = nil
        do {
            try await client.disconnectGoogleCalendar()
            await refreshStatus()
        } catch {
            errorMessage = "Couldn't disconnect. Try again."
        }
    }

    private func sync() async {
        guard let client = session.client else { return }
        errorMessage = nil
        isSyncing = true
        defer { isSyncing = false }
        do {
            try await client.syncGoogleCalendar()
            await refreshStatus()
            await model.reload()
        } catch {
            errorMessage = "Sync failed. Try again in a moment."
        }
    }
}
