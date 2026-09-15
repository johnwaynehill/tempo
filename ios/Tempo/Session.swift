import Foundation
import Observation
import TempoKit

/// Who is signed in and how to talk to the API. Injected via `.environment`.
@Observable @MainActor
final class Session {
    private static let keychainKey = AppGroup.apiKeyKeychainKey
    /// Stored next to the key so extensions talk to the same server as the app.
    static let baseURLKeychainKey = AppGroup.baseURLKeychainKey

    /// Where requests go. Production unless `TEMPO_API_URL` is set (environment
    /// variable or `-TEMPO_API_URL <url>` launch argument), e.g. `http://localhost:3001`.
    let baseURL: URL

    private(set) var apiKey: String?
    private(set) var client: TempoClient?
    private(set) var me: AuthMe?

    var isSignedIn: Bool { client != nil }

    init() {
        baseURL = Session.resolveBaseURL()
        // Keys saved before extensions existed sit in the app's private group; move them so the
        // widget, share extension and App Intents can read them.
        Keychain.migrateToSharedGroup(Session.keychainKey)
        // `TEMPO_API_KEY` in the environment signs in without the Keychain — for
        // simulator runs and UI checks only; it is never stored.
        let envKey = ProcessInfo.processInfo.environment["TEMPO_API_KEY"]
        if let key = envKey ?? Keychain.read(Session.keychainKey), !key.isEmpty {
            apiKey = key
            client = TempoClient(baseURL: baseURL, apiKey: key)
        }
    }

    /// Verifies the key against `GET /api/auth/me`, then stores it.
    func signIn(apiKey rawKey: String) async throws {
        let key = rawKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidate = TempoClient(baseURL: baseURL, apiKey: key)
        let profile: AuthMe
        do {
            profile = try await candidate.me()
        } catch let error as TempoAPIError {
            throw SignInError(error)
        }

        do {
            try Keychain.save(key, for: Session.keychainKey)
            try Keychain.save(baseURL.absoluteString, for: Session.baseURLKeychainKey)
        } catch {
            throw SignInError.keychain
        }

        apiKey = key
        client = candidate
        me = profile
    }

    func signOut() {
        Keychain.delete(Session.keychainKey)
        Keychain.delete(Session.baseURLKeychainKey)
        apiKey = nil
        client = nil
        me = nil
    }

    private static func resolveBaseURL() -> URL {
        let env = ProcessInfo.processInfo.environment["TEMPO_API_URL"]
        let arg = UserDefaults.standard.string(forKey: "TEMPO_API_URL")
        if let raw = env ?? arg,
           let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
           url.scheme != nil {
            return url
        }
        return TempoClient.productionURL
    }
}

/// Readable sign-in failures. Wraps `TempoAPIError` so views never see raw status codes.
enum SignInError: LocalizedError {
    case rejected
    case offline
    case server(Int)
    case keychain
    case unknown

    init(_ error: TempoAPIError) {
        switch error {
        case .unauthorized: self = .rejected
        case .transport: self = .offline
        case .http(let status, _): self = .server(status)
        case .decoding, .invalidResponse: self = .unknown
        }
    }

    var errorDescription: String? {
        switch self {
        case .rejected: "That key wasn't accepted. Check it and try again."
        case .offline: "Couldn't reach Tempo. Check your connection."
        case .server(let status): "Tempo answered with an error (\(status)). Try again in a moment."
        case .keychain: "Signed in, but the key couldn't be saved on this device."
        case .unknown: "Something unexpected came back. Try again."
        }
    }
}
