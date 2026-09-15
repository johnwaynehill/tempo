import CryptoKit
import Foundation

/// The App Group the app and its extensions share: the offline cache the widget reads, the
/// inbox where the share extension and App Intents drop writes for the app to import, and the
/// timer state the widget and intents need to see. Free personal teams support App Groups.
enum AppGroup {
    static let identifier = "group.com.johnwaynehill.Tempo"

    /// Nil on a build without the App Group entitlement (a simulator build with signing disabled).
    static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
    }

    /// Defaults shared across processes. Without the entitlement this still returns a suite,
    /// it just isn't visible to the extensions, so callers never need a fallback path.
    /// Computed rather than stored: `UserDefaults` isn't `Sendable`, and the system caches
    /// suites by name, so building one per access costs nothing.
    static var defaults: UserDefaults {
        UserDefaults(suiteName: identifier) ?? .standard
    }

    /// Key for the JSON-encoded `TimerState` in `defaults`; the app writes it, the widget and
    /// App Intents read it.
    static let timerStateKey = "tempo-timer-state"

    /// Keychain keys the app writes at sign-in and extensions read.
    static let apiKeyKeychainKey = "apiKey"
    static let baseURLKeychainKey = "apiBaseURL"

    /// Where extensions drop `WriteOp`s for the app to import; one file per op.
    static var inboxURL: URL? {
        containerURL?.appendingPathComponent("Inbox", isDirectory: true)
    }

    /// First 12 hex characters of SHA-256(API key): one cache folder per account, so signing
    /// out can't wipe anyone else's data, and the key itself never appears in a path.
    static func accountFolderName(forAPIKey apiKey: String) -> String {
        let digest = SHA256.hash(data: Data(apiKey.utf8))
        return String(digest.map { String(format: "%02x", $0) }.joined().prefix(12))
    }

    /// `<container>/Tempo/<account folder>` — the `TempoStore` directory the widget reads.
    static func accountDirectory(forAPIKey apiKey: String) -> URL? {
        containerURL?
            .appendingPathComponent("Tempo", isDirectory: true)
            .appendingPathComponent(accountFolderName(forAPIKey: apiKey), isDirectory: true)
    }
}
