import UIKit
import UserNotifications

/// UIKit hooks SwiftUI doesn't offer: the APNs device token, and notifications (showing them
/// while Tempo is open, and opening the right screen when one is tapped).
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
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
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let info = response.notification.request.content.userInfo
        // Local reminders are identified by the todo's id; pushes and nudges carry it in userInfo.
        let todoId = (info["todoId"] as? String).flatMap(UUID.init(uuidString:))
            ?? UUID(uuidString: response.notification.request.identifier)
        let kind = info["kind"] as? String
        await MainActor.run {
            NotificationRouter.open(todoId: todoId, kind: kind)
        }
    }
}

/// Hands a tapped notification to the live model, or holds it until the model exists
/// (a tap that launched the app arrives before sign-in has built one).
@MainActor
enum NotificationRouter {
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
        if let id = request.todoId {
            model.openTodoRequested = id
        } else if request.kind == "plan" {
            model.todayRequested = true
        }
    }
}
