import Foundation
import TempoKit
import UserNotifications

/// Turns `reminderAt` into local notifications that fire with the app closed.
///
/// `sync(todos:)` is called by `AppModel` after every load and mutation: it schedules
/// one request per todo whose reminder is still ahead (identifier = todo id) and
/// removes pending requests for todos that no longer qualify. The server's
/// `reminderAt` is left alone on purpose; the web client clears it after firing and
/// the phone shouldn't fight that.
@MainActor
final class ReminderScheduler {
    private let center: UNUserNotificationCenter
    private var authorizationRequested = false
    private var syncTask: Task<Void, Never>?

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
    }

    /// Mirrors `GENTLE_MESSAGES` in `useReminderScheduler.ts` (PRD §7.4: neutral language).
    static let phrasings: [(String) -> String] = [
        { "Hey, you had this on your list: \($0)" },
        { "Gentle nudge: \($0)" },
        { "Whenever you're ready: \($0)" },
        { "Still on your radar? \($0)" },
    ]

    /// Picks a phrasing that stays the same for a given todo across reschedules and
    /// launches (`hashValue` is per-process, so sum the id's bytes instead).
    static func body(for todo: Todo) -> String {
        let sum = withUnsafeBytes(of: todo.id.uuid) { $0.reduce(0) { $0 &+ Int($1) } }
        return phrasings[sum % phrasings.count](todo.title)
    }

    static func qualifies(_ todo: Todo, now: Date) -> Bool {
        guard let at = todo.reminderAt, todo.status != .done else { return false }
        return at > now
    }

    func sync(todos: [Todo]) {
        syncTask?.cancel()
        let snapshot = todos
        syncTask = Task { [weak self] in
            guard let self else { return }
            await self.reschedule(snapshot)
        }
    }

    private func reschedule(_ todos: [Todo]) async {
        guard await ensureAuthorized() else { return }

        let now = Date()
        let wanted = todos.filter { Self.qualifies($0, now: now) }
        let wantedIds = Set(wanted.map { $0.id.uuidString.lowercased() })

        let pending = await center.pendingNotificationRequests()
        let stale = pending.map(\.identifier).filter { !wantedIds.contains($0) }
        if !stale.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: stale)
        }
        if Task.isCancelled { return }

        for todo in wanted {
            guard let at = todo.reminderAt else { continue }
            let content = UNMutableNotificationContent()
            content.title = todo.title
            content.body = Self.body(for: todo)
            content.sound = .default
            content.threadIdentifier = "reminders"

            let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: at)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            let request = UNNotificationRequest(
                identifier: todo.id.uuidString.lowercased(), content: content, trigger: trigger
            )
            // Adding with an existing identifier replaces it, so a moved reminder just moves.
            try? await center.add(request)
        }
    }

    /// Asks once for alert + sound; afterwards only reports whether we may schedule.
    private func ensureAuthorized() async -> Bool {
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return true
        case .notDetermined:
            guard !authorizationRequested else { return false }
            authorizationRequested = true
            return (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        case .denied:
            return false
        @unknown default:
            return false
        }
    }
}
