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
            UIApplication.shared.registerForRemoteNotifications()
        default:
            setActive(false)
        }
    }

    /// Notifications were just allowed (the first-run prompt): ask for a token right away.
    func permissionGranted() {
        guard let client else { return }
        Task { await refresh(client: client) }
    }

    func didRegister(_ token: Data) {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        deviceToken = hex
        Task { await upload(hex) }
    }

    func didFailToRegister(_ error: any Error) {
        log.info("register: failed \(String(describing: error), privacy: .public)")
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
        guard let client else { return }
        do {
            try await client.registerPushDevice(
                token: token,
                environment: Self.environment,
                bundleId: Bundle.main.bundleIdentifier ?? "com.johnwaynehill.Tempo"
            )
            log.info("register: server has the token (\(Self.environment, privacy: .public))")
            setActive(true)
        } catch {
            log.info("register: upload failed \(String(describing: error), privacy: .public)")
            setActive(false)
        }
    }

    private func setActive(_ active: Bool) {
        guard active != isActive else { return }
        isActive = active
        onActiveChange?()
    }
}
