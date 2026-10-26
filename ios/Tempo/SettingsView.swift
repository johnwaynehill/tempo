import AuthenticationServices
import SwiftUI
import TempoKit
import UserNotifications

/// Account, planning preferences, appearance, reminders, Google Calendar connect and Tempo AI
/// usage — the parts of the web's `Settings.tsx` that matter on a phone. API keys, data export
/// and CSV import stay on the web.
struct SettingsView: View {
    @Environment(Session.self) private var session
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuthSession
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL

    @State private var status: GoogleCalendarStatus?
    @State private var isLoading = true
    @State private var isConnecting = false
    @State private var isSyncing = false
    /// The Google account being disconnected, while that's in flight.
    @State private var disconnectingId: String?
    @State private var errorMessage: String?
    @State private var aiUsage: AiUsageSummary?
    @State private var notificationStatus: UNAuthorizationStatus?

    private var prefs: UserPreferences { model.preferences ?? UserPreferences() }

    var body: some View {
        List {
            PageHeader(title: "Settings")
                .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            if let me = session.me {
                SectionLabel(text: "Account")
                    .plainRow(bottom: Theme.grid)
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
                .frame(maxWidth: .infinity, alignment: .leading)
                .settingsCard()
                .cardRow()
            }

            if model.parkedCount > 0 {
                ParkedWritesBanner()
                    .cardRow()
            }

            SectionLabel(text: "Planning")
                .plainRow(top: Theme.grid * 2, bottom: Theme.grid)
            planningCard
                .settingsCard()
                .cardRow()

            SectionLabel(text: "Appearance")
                .plainRow(top: Theme.grid * 2, bottom: Theme.grid)
            appearanceCard
                .settingsCard()
                .cardRow()

            SectionLabel(text: "Reminders")
                .plainRow(top: Theme.grid * 2, bottom: Theme.grid)
            remindersCard
                .settingsCard()
                .cardRow()

            SectionLabel(text: "Google Calendar")
                .plainRow(top: Theme.grid * 2, bottom: Theme.grid)
            googleCalendarCard
                .settingsCard()
                .cardRow()

            if let errorMessage {
                Text(errorMessage)
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.error)
                    .plainRow(top: Theme.grid)
            }

            SectionLabel(text: "Tempo AI")
                .plainRow(top: Theme.grid * 2, bottom: Theme.grid)
            aiUsageCard
                .settingsCard()
                .cardRow()

            Text(versionLine)
                .font(Theme.font(.footnote))
                .foregroundStyle(Theme.onSurfaceVariant)
                .monospacedDigit()
                .plainRow(top: Theme.grid * 2, bottom: Theme.grid * 4)
        }
        .tempoList()
        .task { await refreshStatus() }
        .task { await loadAiUsage() }
        // Coming back from the Settings app after turning notifications on.
        .onChange(of: scenePhase, initial: true) { _, phase in
            guard phase == .active else { return }
            Task { await refreshNotificationStatus() }
        }
    }

    // MARK: Planning

    @ViewBuilder
    private var planningCard: some View {
        VStack(alignment: .leading, spacing: Theme.grid * 2) {
            VStack(alignment: .leading, spacing: Theme.grid) {
                SettingTitle(
                    title: "Working hours",
                    detail: "Used to check whether today's plan fits in the time you have."
                )
                HStack(spacing: Theme.grid) {
                    DatePicker("Start", selection: clockBinding(\.workDayStart) { UserPreferencesUpdate(workDayStart: $0) },
                               displayedComponents: .hourAndMinute)
                        .labelsHidden()
                    Text("to")
                        .font(Theme.font(.footnote))
                        .foregroundStyle(Theme.onSurfaceVariant)
                    DatePicker("End", selection: clockBinding(\.workDayEnd) { UserPreferencesUpdate(workDayEnd: $0) },
                               displayedComponents: .hourAndMinute)
                        .labelsHidden()
                    Spacer(minLength: 0)
                }
                if prefs.workDayEnd <= prefs.workDayStart {
                    Text("The end is before the start, so every plan will look overcommitted.")
                        .font(Theme.font(.footnote))
                        .foregroundStyle(Theme.error)
                }
            }

            Toggle(isOn: Binding(
                get: { prefs.autoplanEnabled },
                set: { on in Task { await model.updatePreferences(UserPreferencesUpdate(autoplanEnabled: on)) } }
            )) {
                SettingTitle(
                    title: "Morning auto-plan",
                    detail: "Let Tempo AI pre-fill Today with 3–5 tasks each morning. Replaces whatever's in Today."
                )
            }
            .tint(Theme.primary)

            if prefs.autoplanEnabled {
                timeZoneRow
            }
        }
    }

    private var timeZoneRow: some View {
        let device = TimeZone.current.identifier
        return VStack(alignment: .leading, spacing: Theme.grid) {
            HStack {
                SettingTitle(title: "Time zone", detail: "When \"today\" starts for the morning plan.")
                Spacer(minLength: Theme.grid)
                Text(prefs.autoplanTimezone.replacingOccurrences(of: "_", with: " "))
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .multilineTextAlignment(.trailing)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.outlineVariant)
            }
            .contentShape(Rectangle())
            .navigates {
                TimeZonePickerView(selected: prefs.autoplanTimezone) { zone in
                    Task { await model.updatePreferences(UserPreferencesUpdate(autoplanTimezone: zone)) }
                }
            }

            if prefs.autoplanTimezone != device {
                Button("Use this phone's time zone (\(device.replacingOccurrences(of: "_", with: " ")))") {
                    Task { await model.updatePreferences(UserPreferencesUpdate(autoplanTimezone: device)) }
                }
                .font(Theme.font(.footnote, weight: .medium))
                .foregroundStyle(Theme.primary)
                .buttonStyle(.borderless)
            }
        }
    }

    /// A `"HH:MM"` preference as a `Date` today, for the time pickers. Writes go straight to the
    /// queue, which applies them optimistically.
    private func clockBinding(
        _ key: KeyPath<UserPreferences, String>,
        update: @escaping (String) -> UserPreferencesUpdate
    ) -> Binding<Date> {
        Binding(
            get: { Clock.date(from: prefs[keyPath: key], calendar: model.calendar) },
            set: { date in
                let value = Clock.string(from: date, calendar: model.calendar)
                guard value != prefs[keyPath: key] else { return }
                Task { await model.updatePreferences(update(value)) }
            }
        )
    }

    // MARK: Appearance

    private var appearanceCard: some View {
        VStack(alignment: .leading, spacing: Theme.grid * 1.5) {
            SettingTitle(title: "Theme", detail: "Shared with the web app.")
            HStack(spacing: Theme.grid) {
                ForEach([ThemePreference.system, .light, .dark], id: \.self) { option in
                    SelectableChip(label: option.label, isSelected: prefs.theme == option) {
                        Task { await model.updatePreferences(UserPreferencesUpdate(theme: option)) }
                    }
                }
            }
        }
    }

    // MARK: Reminders

    private var remindersCard: some View {
        VStack(alignment: .leading, spacing: Theme.grid * 2) {
            notificationPermissionRow
            habitReminderRow
        }
    }

    /// One push a day at the chosen time, sent by the server only if habits are still open.
    @ViewBuilder
    private var habitReminderRow: some View {
        Toggle(isOn: Binding(
            get: { prefs.habitReminderEnabled },
            set: { on in
                // The time is read in the account's time zone, which otherwise only the morning
                // plan sets; with that off, take the phone's so 8 PM means 8 PM here.
                let device = TimeZone.current.identifier
                let zone = on && !prefs.autoplanEnabled && prefs.autoplanTimezone != device ? device : nil
                Task { await model.updatePreferences(UserPreferencesUpdate(autoplanTimezone: zone, habitReminderEnabled: on)) }
            }
        )) {
            SettingTitle(
                title: "Daily habit reminder",
                detail: "Once a day, at a time you pick, if any of today's habits are still open."
            )
        }
        .tint(Theme.primary)

        if prefs.habitReminderEnabled {
            HStack {
                Text("Remind me at")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurface)
                Spacer(minLength: Theme.grid)
                DatePicker("Remind me at", selection: clockBinding(\.habitReminderTime) { UserPreferencesUpdate(habitReminderTime: $0) },
                           displayedComponents: .hourAndMinute)
                    .labelsHidden()
            }
        }
    }

    @ViewBuilder
    private var notificationPermissionRow: some View {
        HStack(spacing: Theme.grid * 2) {
            SettingTitle(title: "Reminder notifications", detail: reminderDetail)
            Spacer(minLength: 0)
            switch notificationStatus {
            case .notDetermined:
                Button("Turn on") { Task { await requestNotifications() } }
                    .buttonStyle(SecondaryButtonStyle())
            case .denied:
                Button("Settings") {
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                }
                .buttonStyle(SecondaryButtonStyle())
            case .authorized, .provisional, .ephemeral:
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(Theme.primary)
                    .accessibilityLabel("On")
            default:
                EmptyView()
            }
        }
    }

    private var reminderDetail: String {
        switch notificationStatus {
        case .authorized, .provisional, .ephemeral:
            "A todo's reminder arrives on this phone, even with Tempo closed."
        case .denied:
            "Notifications are off for Tempo, so reminders can't arrive. Turn them on in Settings."
        default:
            "Allow notifications so a todo's reminder arrives on this phone."
        }
    }

    private func refreshNotificationStatus() async {
        notificationStatus = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    private func requestNotifications() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
        await refreshNotificationStatus()
        // Schedule anything already waiting now that it's allowed.
        if notificationStatus == .authorized { await model.reload() }
    }

    // MARK: Tempo AI

    @ViewBuilder
    private var aiUsageCard: some View {
        VStack(alignment: .leading, spacing: Theme.grid * 1.5) {
            HStack(alignment: .firstTextBaseline) {
                SettingTitle(
                    title: "Today's AI usage",
                    detail: "AI features pause for the day at the cap and pick up again at midnight."
                )
                Spacer(minLength: Theme.grid)
                Text(aiUsage.map { String(format: "$%.2f of $%.2f", $0.today.spentUsd, $0.today.capUsd) } ?? "—")
                    .font(Theme.font(.subheadline, weight: .medium))
                    .foregroundStyle(Theme.onSurface)
                    .monospacedDigit()
                    .fixedSize()
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.surfaceContainerHigh)
                    Capsule().fill(Theme.primary)
                        .frame(width: proxy.size.width * aiFraction)
                }
            }
            .frame(height: 6)
            if let usage = aiUsage {
                let total = usage.history.reduce(0) { $0 + $1.spentUsd }
                let days = usage.history.count
                let history = days == 0 ? "" : " · " + String(format: "$%.2f", total)
                    + " over the last \(days) day\(days == 1 ? "" : "s") with any use"
                Text("\(usage.today.requests) request\(usage.today.requests == 1 ? "" : "s") today" + history)
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .monospacedDigit()
            }
        }
    }

    private var aiFraction: CGFloat {
        guard let today = aiUsage?.today, today.capUsd > 0 else { return 0 }
        return min(1, today.spentUsd / today.capUsd)
    }

    private func loadAiUsage() async {
        guard let client = session.client else { return }
        aiUsage = try? await client.aiUsage()
    }

    private var versionLine: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "Tempo for iOS \(version) (\(build))"
    }

    // MARK: Google Calendar

    @ViewBuilder
    private var googleCalendarCard: some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            if isLoading {
                HStack { Spacer(); ProgressView().tint(Theme.onSurfaceVariant); Spacer() }
            } else if let status, status.connected {
                // A server from before several accounts sends no list; show its one account.
                let accounts = status.accounts.isEmpty
                    ? [GoogleCalendarAccount(id: "", email: status.email, lastSyncedAt: status.lastSyncedAt, lastSyncError: status.lastSyncError)]
                    : status.accounts
                ForEach(accounts) { account in
                    accountRow(account)
                }
                HStack(spacing: Theme.grid) {
                    Button(isSyncing ? "Syncing…" : "Sync now") { Task { await sync() } }
                        .buttonStyle(SecondaryButtonStyle())
                        .disabled(isSyncing || isConnecting)
                    Button(isConnecting ? "Connecting…" : "Add account") { Task { await connect() } }
                        .buttonStyle(SecondaryButtonStyle())
                        .disabled(isSyncing || isConnecting)
                }
                .padding(.top, Theme.grid)
                Text("Each account's primary calendar shows on Today. A meeting on more than one of them shows once.")
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.onSurfaceVariant)
            } else {
                Text("Connect your Google Calendar so events show up on Today and count toward your day's availability. You can connect more than one Google account.")
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.onSurfaceVariant)
                Button(isConnecting ? "Connecting…" : "Connect Google Calendar") { Task { await connect() } }
                    .buttonStyle(BarPrimaryButtonStyle())
                    .disabled(isConnecting)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // Two buttons in one List row: without this, a tap anywhere fires both.
        .buttonStyle(.borderless)
    }

    private func accountRow(_ account: GoogleCalendarAccount) -> some View {
        HStack(alignment: .top, spacing: Theme.grid * 2) {
            VStack(alignment: .leading, spacing: 2) {
                Text(account.email ?? "Google account")
                    .font(Theme.font(.subheadline, weight: .medium))
                    .foregroundStyle(Theme.onSurface)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if let error = account.lastSyncError {
                    Text(error)
                        .font(Theme.font(.footnote))
                        .foregroundStyle(Theme.error)
                        .lineLimit(2)
                } else if let synced = account.lastSyncedAt {
                    Text("Synced \(synced, format: .relative(presentation: .named))")
                        .font(Theme.font(.footnote))
                        .foregroundStyle(Theme.onSurfaceVariant)
                } else {
                    Text("Not synced yet")
                        .font(Theme.font(.footnote))
                        .foregroundStyle(Theme.onSurfaceVariant)
                }
            }
            Spacer(minLength: 0)
            Button(disconnectingId == account.id ? "Disconnecting…" : "Disconnect", role: .destructive) {
                Task { await disconnect(account) }
            }
            .font(Theme.font(.footnote, weight: .medium))
            .foregroundStyle(Theme.error)
            .disabled(disconnectingId != nil)
        }
        .padding(.vertical, 4)
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
            await model.reload()
        } catch is CancellationError {
            // User dismissed the sheet — not an error worth surfacing.
        } catch let authError as ASWebAuthenticationSessionError where authError.code == .canceledLogin {
            // Same dismissal, thrown as an NSError instead on some OS versions.
        } catch {
            errorMessage = "Couldn't connect Google Calendar. Try again."
        }
    }

    private func disconnect(_ account: GoogleCalendarAccount) async {
        guard let client = session.client else { return }
        errorMessage = nil
        disconnectingId = account.id
        defer { disconnectingId = nil }
        do {
            // An empty id is the one account an older server described without a list.
            if account.id.isEmpty {
                try await client.disconnectGoogleCalendar()
            } else {
                try await client.disconnectGoogleCalendar(accountId: account.id)
            }
            await refreshStatus()
            // The server purges the mirrored events; drop them from Today too.
            await model.reload()
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

/// A setting's name with a quiet line of explanation under it.
private struct SettingTitle: View {
    var title: String
    var detail: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(Theme.font(.subheadline, weight: .medium))
                .foregroundStyle(Theme.onSurface)
            if let detail {
                Text(detail)
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private extension View {
    func settingsCard() -> some View {
        self
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.grid * 2)
            .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }
}

private extension ThemePreference {
    var label: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
}

/// `"HH:MM"` wall-clock strings, the way the preferences store working hours.
enum Clock {
    static func date(from clock: String, on day: Date = Date(), calendar: Calendar) -> Date {
        let parts = clock.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return day }
        return calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: day) ?? day
    }

    static func string(from date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}

/// Every IANA zone, searchable, with this phone's zone on top.
private struct TimeZonePickerView: View {
    var selected: String
    var onPick: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var zones: [String] {
        let all = TimeZone.knownTimeZoneIdentifiers
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return all }
        return all.filter { $0.replacingOccurrences(of: "_", with: " ").localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        List {
            if query.isEmpty {
                Section("This phone") { row(TimeZone.current.identifier) }
            }
            Section(query.isEmpty ? "All time zones" : "Results") {
                ForEach(zones, id: \.self) { row($0) }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.surface.ignoresSafeArea())
        .navigationTitle("Time zone")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always))
    }

    private func row(_ zone: String) -> some View {
        Button {
            onPick(zone)
            dismiss()
        } label: {
            HStack {
                Text(zone.replacingOccurrences(of: "_", with: " "))
                    .foregroundStyle(Theme.onSurface)
                Spacer()
                if zone == selected {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Theme.primary)
                }
            }
        }
    }
}
