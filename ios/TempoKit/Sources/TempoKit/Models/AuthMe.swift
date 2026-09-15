import Foundation

/// `GET /api/auth/me`.
public struct AuthMe: Codable, Identifiable, Hashable, Sendable {
    public var uid: String
    public var email: String?
    public var displayName: String?
    public var photoURL: String?

    public var id: String { uid }

    public init(uid: String, email: String? = nil, displayName: String? = nil, photoURL: String? = nil) {
        self.uid = uid
        self.email = email
        self.displayName = displayName
        self.photoURL = photoURL
    }
}
