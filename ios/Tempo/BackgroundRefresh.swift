import BackgroundTasks
import Foundation
import TempoKit
import WidgetKit
import os

/// Keeps the widgets current when Tempo isn't opened: an app-refresh task that sends queued
/// writes, pulls Today and reloads the widget timelines. iOS decides when it runs (it learns
/// from how often the app is used); each run asks for the next one about 30 minutes out.
@MainActor
enum BackgroundRefresh {
    static let identifier = "com.johnwaynehill.Tempo.refresh"
    static let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "background")

    /// The live model, when the app has one. A refresh goes through it so the screen and the
    /// store never disagree; without one (iOS woke the app with no window) the task opens the
    /// account's store directly.
    static weak var model: AppModel?

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            log.info("schedule: \(String(describing: error), privacy: .public)")
        }
    }

    static func run(session: Session) async {
        schedule()
        if let model {
            log.info("run: through the live model")
            await model.reload()
            return
        }
        guard let client = session.client, let key = session.apiKey else {
            log.info("run: signed out")
            return
        }
        let store = TempoStore(client: client, directory: AppModel.storeDirectory(for: key))
        if let inbox = AppGroup.inboxURL {
            _ = await PendingOpInbox(directory: inbox).drain(into: store)
        }
        let flushed = await store.flush()
        do {
            _ = try await store.refreshToday()
            log.info("run: refreshed (sent \(flushed.sent))")
        } catch {
            log.info("run: refresh failed \(String(describing: error), privacy: .public)")
        }
        WidgetCenter.shared.reloadAllTimelines()
    }
}
