import Foundation
import os
import TempoKit
import UIKit
import UserNotifications

/// Registers this device for push (Docs/PushNotifications.md). Once the server has the
/// token, reminders arrive as pushes, so `ReminderScheduler` stands its local copies down;
/// until then (no permission, offline, APNs refused) local reminders carry on as before.
@MainActor
final class PushRegistration {
    static let shared = PushRegistration()

    private let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "push")
    private var client: TempoClient?
    /// Hex APNs token, once iOS hands one over.
    private(set) var deviceToken: String?
    /// The server confirmed it has this device's token for the signed-in account.
    private(set) var isActive = false
    /// Told when `isActive` changes, so reminders can be rescheduled.
    var onActiveChange: (() -> Void)?
    /// Bumped on every token request, so a late answer doesn't trip an older request's warning.
    private var requestCount = 0
    private var answeredCount = 0

    static var environment: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }

    /// Asks iOS for a token when notifications are allowed. Cheap; call on launch and foreground.
    func refresh(client: TempoClient) async {
        self.client = client
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        switch status {
        case .authorized, .provisional, .ephemeral:
            requestCount += 1
            let request = requestCount
            log.info("register: asking iOS for a token (\(Self.environment, privacy: .public))")
            UIApplication.shared.registerForRemoteNotifications()
            // iOS answers with a token or an error, usually within a second. Silence means the
            // phone can't reach Apple's push service (a VPN or network blocking it), and iOS
            // keeps waiting without saying so.
            Task {
                try? await Task.sleep(for: .seconds(15))
                if answeredCount < request {
                    log.error("register: no answer from iOS after 15 s; can this phone reach Apple's push service?")
                }
            }
        default:
            log.info("register: notifications not allowed (status \(status.rawValue, privacy: .public))")
            setActive(false)
        }
    }

    /// Notifications were just allowed (the first-run prompt): ask for a token right away.
    func permissionGranted() {
        guard let client else { return }
        Task { await refresh(client: client) }
    }

    func didRegister(_ token: Data) {
        answeredCount = requestCount
        let hex = token.map { String(format: "%02x", $0) }.joined()
        log.info("register: iOS gave a token \(hex.prefix(8), privacy: .public)…; uploading")
        deviceToken = hex
        Task { await upload(hex) }
    }

    func didFailToRegister(_ error: any Error) {
        answeredCount = requestCount
        log.error("register: failed \(String(describing: error), privacy: .public)")
        setActive(false)
    }

    /// Sign-out: this account stops getting this phone's pushes.
    func unregister() async {
        defer {
            client = nil
            setActive(false)
        }
        guard let client, let deviceToken else { return }
        try? await client.unregisterPushDevice(token: deviceToken)
    }

    private func upload(_ token: String) async {
        guard let client else {
            log.error("register: no API client yet; token not uploaded")
            return
        }
        do {
            try await client.registerPushDevice(
                token: token,
                environment: Self.environment,
                bundleId: Bundle.main.bundleIdentifier ?? "com.johnwaynehill.Tempo"
            )
            log.info("register: server has the token (\(Self.environment, privacy: .public))")
            setActive(true)
        } catch {
            log.error("register: upload failed \(String(describing: error), privacy: .public)")
            setActive(false)
        }
    }

    private func setActive(_ active: Bool) {
        guard active != isActive else { return }
        isActive = active
        onActiveChange?()
    }
}
