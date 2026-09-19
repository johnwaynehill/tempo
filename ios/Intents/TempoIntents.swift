import AppIntents
import Foundation
import os

// App Intents shared by the app and the widget extension: Shortcuts actions, App Shortcut
// phrases, and the widget's interactive buttons. None of them need the Siri capability.
//
// Each intent works with the app closed, from the App Group alone (cached snapshot, shared timer
// defaults, the `PendingOpInbox`). When the app's `AppModel` is alive in the same process it
// registers itself as the `TempoIntentHost`, and intents go through it instead so the running
// app never disagrees with what an intent just did.

/// What the running app offers intents. `AppModel` conforms; the widget extension never sets one.
@MainActor
protocol TempoIntentHost: AnyObject {
    /// Starts the timer on Today's first task. Nil when the app can't answer yet (still on its
    /// first load), so the intent uses the shared-container path instead.
    func startNextTask() async -> StartNextOutcome?
    /// Completes whatever's on the clock, banking the run's minutes. Nil when the app can't
    /// answer yet, so the intent uses the shared-container path instead.
    func completeActiveTask() async -> CompleteActiveOutcome?
    /// Re-reads the timer another process saved to the App Group.
    func adoptSharedTimer()
    /// Creates an Inbox todo through the app's queue.
    func addTodo(title: String) async
    /// Marks a habit done or not-done for a day, through the app's queue. Unlike Start Next and
    /// Complete this needs no `hasLoaded` guard: it writes blind from just an id, nothing read
    /// from in-memory state first.
    func toggleHabit(id: UUID, date: String, completed: Bool) async
    /// Picks up a pending Start focus request.
    func consumeFocusRequest()
}

@MainActor
enum TempoIntentBridge {
    /// The live app model in this process, if any. Weak: signing out drops the model.
    static weak var host: (any TempoIntentHost)?

    /// `AppGroup.defaults` key holding the time a Start focus request was made.
    static let focusRequestKey = "tempo-focus-request"

    /// Records a Start focus request for whichever part of the app sees it first.
    static func requestFocus(now: Date = Date()) {
        AppGroup.defaults.set(now.timeIntervalSince1970, forKey: focusRequestKey)
        host?.consumeFocusRequest()
    }

    /// True (and cleared) when a Start focus request is waiting. Requests older than two minutes
    /// are dropped so an old one can't ambush a later launch.
    static func takeFocusRequest(now: Date = Date()) -> Bool {
        let defaults = AppGroup.defaults
        guard let stamp = defaults.object(forKey: focusRequestKey) as? Double else { return false }
        defaults.removeObject(forKey: focusRequestKey)
        return now.timeIntervalSince1970 - stamp < 120
    }
}

/// The result of Start next, whichever path produced it.
enum StartNextOutcome: Sendable, Equatable {
    case started(title: String)
    case alreadyRunning(title: String)
    case nothingToday
    case signedOut

    var dialog: String {
        switch self {
        case .started(let title): "Started \(title)."
        case .alreadyRunning(let title): "Already on the clock: \(title)."
        case .nothingToday: "Nothing on Today. Enjoy the quiet."
        case .signedOut: "Open Tempo and sign in first."
        }
    }

    var logDescription: String {
        switch self {
        case .started(let title): "started \"\(title)\""
        case .alreadyRunning(let title): "alreadyRunning \"\(title)\""
        case .nothingToday: "nothingToday"
        case .signedOut: "signedOut"
        }
    }
}

/// The result of Complete next, whichever path produced it.
enum CompleteActiveOutcome: Sendable, Equatable {
    case completed(title: String)
    case nothingActive
    case signedOut

    var dialog: String {
        switch self {
        case .completed(let title): "Nice work. \(title) is done."
        case .nothingActive: "Nothing's on the clock right now."
        case .signedOut: "Open Tempo and sign in first."
        }
    }

    var logDescription: String {
        switch self {
        case .completed(let title): "completed \"\(title)\""
        case .nothingActive: "nothingActive"
        case .signedOut: "signedOut"
        }
    }
}

enum IntentLog {
    static let logger = Logger(subsystem: "com.johnwaynehill.Tempo", category: "intents")
}
