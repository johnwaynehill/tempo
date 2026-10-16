import FirebaseAuth
import FirebaseCore
import Foundation
import GoogleSignIn
import Observation
import TempoKit
import UIKit

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
        // One configure() call for the process; a second would crash. Session is created once
        // (`TempoApp`'s single `@State`), so this is it.
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
        if let clientID = FirebaseApp.app()?.options.clientID {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        }
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
        #if DEBUG
        // Simulator checks of the widget, share extension and App Intents need the key in the
        // shared Keychain, which the environment sign-in above deliberately skips. Opt in with
        // TEMPO_DEBUG_STORE_KEY=1; never compiled into release builds.
        if let envKey, !envKey.isEmpty, ProcessInfo.processInfo.environment["TEMPO_DEBUG_STORE_KEY"] == "1" {
            try? Keychain.save(envKey, for: Session.keychainKey)
            try? Keychain.save(baseURL.absoluteString, for: Session.baseURLKeychainKey)
        }
        #endif
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

    /// Google Sign-In, then a fresh Firebase ID token, then one server round trip that mints a
    /// plain Tempo API key from it (`POST /api/api-keys`, authenticated with that ID token
    /// instead of a key). From there it's `signIn(apiKey:)` as usual: the widget, share
    /// extension and App Intents never need to know Firebase exists, because what ends up in
    /// the shared Keychain is a key exactly like a pasted one.
    func signInWithGoogle(presenting viewController: UIViewController) async throws {
        let result: GIDSignInResult
        do {
            result = try await GIDSignIn.sharedInstance.signIn(withPresenting: viewController)
        } catch GIDSignInError.canceled {
            throw SignInError.googleCancelled
        }
        guard let idToken = result.user.idToken?.tokenString else { throw SignInError.google }
        let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: result.user.accessToken.tokenString)

        let authResult: AuthDataResult
        do {
            authResult = try await Auth.auth().signIn(with: credential)
        } catch {
            throw SignInError.firebase
        }

        let firebaseToken: String
        do {
            firebaseToken = try await authResult.user.getIDToken()
        } catch {
            throw SignInError.firebase
        }

        let minted = try await Session.mintAPIKey(baseURL: baseURL, firebaseIDToken: firebaseToken)
        try await signIn(apiKey: minted)
    }

    /// `POST /api/api-keys`, authenticated with a Firebase ID token rather than an existing
    /// Tempo key — the one call the server's `authenticate` middleware accepts either kind of
    /// credential for. Scoped to read/write only; the iOS app never uses the AI proxy.
    private static func mintAPIKey(baseURL: URL, firebaseIDToken: String) async throws -> String {
        struct Body: Encodable { var name: String; var scopes: [String] }
        struct Created: Decodable { var key: String }

        var request = URLRequest(url: baseURL.appendingPathComponent("api/api-keys"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(firebaseIDToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(Body(name: "iOS (Google Sign-In)", scopes: ["read", "write"]))

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw SignInError.offline
        }
        guard let http = response as? HTTPURLResponse else { throw SignInError.unknown }
        guard (200..<300).contains(http.statusCode) else { throw SignInError.server(http.statusCode) }
        guard let created = try? JSONDecoder().decode(Created.self, from: data) else { throw SignInError.unknown }
        return created.key
    }

    func signOut() {
        Keychain.delete(Session.keychainKey)
        Keychain.delete(Session.baseURLKeychainKey)
        apiKey = nil
        client = nil
        me = nil
        // So a later Sign in with Google offers the account picker again rather than
        // silently reusing whatever Google/Firebase still remembers.
        GIDSignIn.sharedInstance.signOut()
        try? Auth.auth().signOut()
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
    /// The user dismissed the Google account picker; not really a failure.
    case googleCancelled
    case google
    case firebase

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
        case .googleCancelled: "Sign-in was cancelled."
        case .google: "Google Sign-In didn't complete. Try again."
        case .firebase: "Couldn't confirm your Google account with Tempo. Try again."
        }
    }
}
