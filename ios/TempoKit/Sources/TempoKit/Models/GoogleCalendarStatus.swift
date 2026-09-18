import Foundation

/// `GET /api/google-calendar/status`. Google account link state for Settings.
public struct GoogleCalendarStatus: Codable, Hashable, Sendable {
    public var connected: Bool
    public var email: String?
    public var syncEnabled: Bool?
    public var lastSyncedAt: Date?
    public var lastSyncError: String?

    public init(
        connected: Bool, email: String? = nil, syncEnabled: Bool? = nil,
        lastSyncedAt: Date? = nil, lastSyncError: String? = nil
    ) {
        self.connected = connected
        self.email = email
        self.syncEnabled = syncEnabled
        self.lastSyncedAt = lastSyncedAt
        self.lastSyncError = lastSyncError
    }
}
