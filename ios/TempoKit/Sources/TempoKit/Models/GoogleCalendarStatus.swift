import Foundation

/// `GET /api/google-calendar/status`. Google account link state for Settings.
public struct GoogleCalendarStatus: Codable, Hashable, Sendable {
    public var connected: Bool
    /// Every connected Google account, oldest first. Empty from a server that predates
    /// several accounts; the single account is then described by the fields below.
    public var accounts: [GoogleCalendarAccount]
    public var email: String?
    public var syncEnabled: Bool?
    public var lastSyncedAt: Date?
    public var lastSyncError: String?

    public init(
        connected: Bool, accounts: [GoogleCalendarAccount] = [], email: String? = nil,
        syncEnabled: Bool? = nil, lastSyncedAt: Date? = nil, lastSyncError: String? = nil
    ) {
        self.connected = connected
        self.accounts = accounts
        self.email = email
        self.syncEnabled = syncEnabled
        self.lastSyncedAt = lastSyncedAt
        self.lastSyncError = lastSyncError
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        connected = try c.decode(Bool.self, forKey: .connected)
        accounts = try c.decodeIfPresent([GoogleCalendarAccount].self, forKey: .accounts) ?? []
        email = try c.decodeIfPresent(String.self, forKey: .email)
        syncEnabled = try c.decodeIfPresent(Bool.self, forKey: .syncEnabled)
        lastSyncedAt = try c.decodeIfPresent(Date.self, forKey: .lastSyncedAt)
        lastSyncError = try c.decodeIfPresent(String.self, forKey: .lastSyncError)
    }
}

/// One connected Google account; its primary calendar is mirrored into Tempo.
public struct GoogleCalendarAccount: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var email: String?
    public var syncEnabled: Bool
    public var lastSyncedAt: Date?
    public var lastSyncError: String?

    public init(
        id: String, email: String? = nil, syncEnabled: Bool = true,
        lastSyncedAt: Date? = nil, lastSyncError: String? = nil
    ) {
        self.id = id
        self.email = email
        self.syncEnabled = syncEnabled
        self.lastSyncedAt = lastSyncedAt
        self.lastSyncError = lastSyncError
    }
}
