import Foundation
import TempoKit

/// Turns something shared from another app (text, a link, a page title) into an Inbox todo,
/// and saves it: straight to the API when it can, otherwise into the App Group inbox for the
/// app to send later. No UIKit here, so the app's DEBUG hook runs exactly what the share
/// extension runs.
enum ShareCapture {
    /// What the share sheet handed over, already reduced to plain values.
    struct Payload: Sendable, Equatable {
        var text: String?
        var url: URL?
        var title: String?

        init(text: String? = nil, url: URL? = nil, title: String? = nil) {
            self.text = Self.clean(text)
            self.url = url
            self.title = Self.clean(title)

            // Many apps share a link as plain text. Promote it, and drop text that only repeats it.
            if let text = self.text {
                if self.url == nil, let link = Self.webURL(text) {
                    self.url = link
                    self.text = nil
                } else if let url = self.url, Self.sameLink(text, url) {
                    self.text = nil
                }
            }
            if let title = self.title, let url = self.url, Self.sameLink(title, url) {
                self.title = nil
            }
        }

        /// Builds a payload from the pieces an `NSExtensionItem` offers. Safari puts the page
        /// title in `attributedContentText` rather than `attributedTitle`, so a single short
        /// line of content text next to a link is read as the title.
        static func fromExtensionItem(title: String?, contentText: String?, urls: [URL], texts: [String]) -> Payload {
            let url = urls.first { $0.scheme == "http" || $0.scheme == "https" } ?? urls.first
            var title = clean(title)
            var text = clean(texts.first { clean($0) != nil })
            if let content = clean(contentText) {
                let isOneLine = !content.contains(where: \.isNewline) && content.count <= 200
                if title == nil, url != nil, isOneLine, !sameLink(content, url!) {
                    title = content
                } else if text == nil {
                    text = content
                }
            }
            return Payload(text: text, url: url, title: title)
        }

        var isEmpty: Bool { text == nil && url == nil && title == nil }

        private static func clean(_ value: String?) -> String? {
            guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return nil }
            return trimmed
        }

        private static func webURL(_ text: String) -> URL? {
            guard !text.contains(where: \.isWhitespace),
                  let url = URL(string: text),
                  let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
                  url.host != nil else { return nil }
            return url
        }

        private static func sameLink(_ text: String, _ url: URL) -> Bool {
            func normal(_ s: String) -> String {
                s.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            }
            return normal(text) == normal(url.absoluteString)
        }
    }

    /// How a save ended, with the sentence the share sheet shows.
    enum Outcome: Sendable, Equatable {
        /// The server has it.
        case added
        /// Written to the App Group inbox; the app sends it next time it runs.
        case queued
        /// No key in the shared Keychain.
        case signedOut
        /// The server turned the key away.
        case keyRejected
        /// Couldn't send it and couldn't keep it either.
        case failed

        var message: String {
            switch self {
            case .added: "Added to your Inbox."
            case .queued: "Saved. It'll sync when you're back online."
            case .signedOut: "Open Tempo and sign in first."
            case .keyRejected: "Open Tempo and sign in again."
            case .failed: "Couldn't save that. Try again in a moment."
            }
        }

        var isSuccess: Bool { self == .added || self == .queued }
    }

    static let titleLimit = 120

    // MARK: Drafting

    /// The title the card starts with: the page title, else the text's first line, else the
    /// link's host and path. Empty only when the payload is.
    static func suggestedTitle(for payload: Payload) -> String {
        if let title = payload.title { return truncate(title) }
        if let line = payload.text?.split(whereSeparator: \.isNewline).lazy
            .map({ $0.trimmingCharacters(in: .whitespaces) }).first(where: { !$0.isEmpty }) {
            return truncate(line)
        }
        if let url = payload.url { return truncate(hostAndPath(url)) }
        return ""
    }

    /// The Inbox draft. `title` is what the person typed (blank falls back to the suggestion);
    /// the description carries the link and any text the title doesn't already say. Keep `id`
    /// stable across retries so a queued copy and a sent copy are the same todo.
    static func draft(for payload: Payload, title: String? = nil, id: UUID = UUID()) -> TodoDraft? {
        let typed = title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let finalTitle = typed.isEmpty ? suggestedTitle(for: payload) : typed
        guard !finalTitle.isEmpty else { return nil }

        var parts: [String] = []
        if let url = payload.url { parts.append(url.absoluteString) }
        if let text = payload.text, text != finalTitle { parts.append(text) }

        return TodoDraft(
            id: id,
            title: finalTitle,
            description: parts.isEmpty ? nil : parts.joined(separator: "\n\n"),
            status: .inbox
        )
    }

    // MARK: Saving

    /// The signed-in key and server, as the app stored them in the shared Keychain.
    static func storedCredentials() -> (apiKey: String, baseURL: URL)? {
        guard let key = Keychain.read(AppGroup.apiKeyKeychainKey), !key.isEmpty else { return nil }
        let baseURL = Keychain.read(AppGroup.baseURLKeychainKey).flatMap(URL.init(string:)) ?? TempoClient.productionURL
        return (key, baseURL)
    }

    /// Sends `draft` to the API with a short timeout. If the server can't be reached (or is
    /// having a moment), the draft goes to the App Group inbox as a `createTodo` op carrying
    /// the same id, so the app's later send can't make a second copy.
    static func save(
        _ draft: TodoDraft,
        credentials: (apiKey: String, baseURL: URL)? = storedCredentials(),
        inbox: URL? = AppGroup.inboxURL,
        timeout: TimeInterval = 6
    ) async -> Outcome {
        guard let credentials else { return .signedOut }

        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout
        config.waitsForConnectivity = false
        let session = URLSession(configuration: config)
        defer { session.finishTasksAndInvalidate() }

        let client = TempoClient(baseURL: credentials.baseURL, apiKey: credentials.apiKey, session: session)
        do {
            _ = try await client.createTodo(draft)
            return .added
        } catch let error as TempoAPIError {
            switch error {
            case .unauthorized:
                return .keyRejected
            case .http(let status, _) where (400..<500).contains(status) && status != 408 && status != 429:
                return .keyRejected
            case .decoding:
                // The server answered 2xx; it has the todo even if the body surprised us.
                return .added
            case .http, .transport, .invalidResponse:
                return queue(draft, in: inbox)
            }
        } catch {
            return queue(draft, in: inbox)
        }
    }

    /// Writes the draft for the app to import. Public for the DEBUG hook and tests.
    static func queue(_ draft: TodoDraft, in inbox: URL?) -> Outcome {
        guard let inbox else { return .failed }
        do {
            try PendingOpInbox(directory: inbox).write(.createTodo(draft: draft))
            return .queued
        } catch {
            return .failed
        }
    }

    // MARK: Helpers

    private static func truncate(_ value: String) -> String {
        let single = value.split(whereSeparator: \.isNewline).joined(separator: " ")
        guard single.count > titleLimit else { return single }
        let cut = single.prefix(titleLimit - 1)
        // Break at a word when one is reasonably close to the limit.
        if let space = cut.lastIndex(of: " "), cut.distance(from: cut.startIndex, to: space) > titleLimit / 2 {
            return cut[..<space].trimmingCharacters(in: .whitespaces) + "…"
        }
        return cut.trimmingCharacters(in: .whitespaces) + "…"
    }

    private static func hostAndPath(_ url: URL) -> String {
        var host = url.host() ?? ""
        if host.hasPrefix("www.") { host.removeFirst(4) }
        var path = url.path()
        while path.hasSuffix("/") { path.removeLast() }
        let joined = host + path
        return joined.isEmpty ? url.absoluteString : joined
    }
}
