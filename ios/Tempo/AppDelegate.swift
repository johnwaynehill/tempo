import os
import UIKit
import UserNotifications

/// UIKit hooks SwiftUI doesn't offer: the APNs device token, and notifications (showing them
/// while Tempo is open, and opening the right screen when one is tapped).
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    override init() {
        super.init()
        // As early as possible: a tap that launches the app is delivered during launch.
        UNUserNotificationCenter.current().delegate = self
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        #if DEBUG
        // TEMPO_DEBUG_NOTIFICATION_TAP=<todo id | kind>[,delay seconds]: acts as if that todo's
        // reminder (or a push of that kind, e.g. "habits") was tapped, at launch (cold) or after the
        // delay (warm). The simulator can't tap banners.
        if let raw = ProcessInfo.processInfo.environment["TEMPO_DEBUG_NOTIFICATION_TAP"] {
            let parts = raw.split(separator: ",").map(String.init)
            let id = UUID(uuidString: parts[0])
            let delay = parts.count > 1 ? Double(parts[1]) ?? 0 : 0
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(delay))
                NotificationRouter.open(todoId: id, kind: id == nil ? parts[0] : "reminder")
            }
        }
        #endif
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushRegistration.shared.didRegister(deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: any Error) {
        PushRegistration.shared.didFailToRegister(error)
    }

    /// Reminders and nudges show as banners even with Tempo in front.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping @Sendable (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }

    /// A tap on a notification. The completion-handler form rather than `async`: the tap that
    /// launches the app arrives mid-launch, and this form is the long-standing, reliable path.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping @Sendable () -> Void
    ) {
        let info = response.notification.request.content.userInfo
        // Local reminders are identified by the todo's id; pushes and nudges carry it in userInfo.
        let todoId = (info["todoId"] as? String).flatMap(UUID.init(uuidString:))
            ?? UUID(uuidString: response.notification.request.identifier)
        let kind = info["kind"] as? String
        NotificationRouter.log.info("tap: kind=\(kind ?? "nil", privacy: .public) todo=\(todoId?.uuidString ?? "nil", privacy: .public)")
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                NotificationRouter.open(todoId: todoId, kind: kind)
            }
            completionHandler()
        }
    }
}

/// Hands a tapped notification to the live model, or holds it until the model exists
/// (a tap that launched the app arrives before sign-in has built one).
@MainActor
enum NotificationRouter {
    nonisolated static let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "push")
    private(set) static var pending: (todoId: UUID?, kind: String?)?

    static weak var model: AppModel? {
        didSet { deliverPending() }
    }

    static func open(todoId: UUID?, kind: String?) {
        pending = (todoId, kind)
        deliverPending()
    }

    private static func deliverPending() {
        guard let model, let request = pending else { return }
        pending = nil
        log.info("route: delivering todo=\(request.todoId?.uuidString ?? "nil", privacy: .public) kind=\(request.kind ?? "nil", privacy: .public)")
        if let id = request.todoId {
            model.openTodoRequested = id
        } else if request.kind == "plan" {
            model.todayRequested = true
        } else if request.kind == "habits" {
            model.habitsRequested = true
        }
    }
}
