import AppIntents
import Foundation

/// "Start focus": opens Tempo straight into Focus Mode, which puts the next task on the clock.
/// The request is a timestamp in the App Group defaults, so it lands whether the app model
/// exists yet (it's told directly) or is created a moment later (it checks on init and on
/// every return to the foreground).
struct StartFocusIntent: AppIntent {
    static let title: LocalizedStringResource = "Start Focus"
    static let description = IntentDescription("Opens Tempo in Focus Mode on your next task.")
    static let supportedModes: IntentModes = .foreground(.immediate)

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        TempoIntentBridge.requestFocus()
        IntentLog.logger.info("focus: requested (host=\(TempoIntentBridge.host == nil ? "none" : "app", privacy: .public))")
        return .result()
    }
}
