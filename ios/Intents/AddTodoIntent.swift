import AppIntents
import Foundation
import TempoKit

/// "Add to Tempo": a new Inbox todo, without opening the app. Sent straight to the server when it
/// answers quickly; otherwise dropped in the App Group inbox for the app to send later.
struct AddTodoIntent: AppIntent {
    static let title: LocalizedStringResource = "Add to Tempo"
    static let description = IntentDescription("Adds a todo to your Tempo Inbox.")
    static let supportedModes: IntentModes = .background

    @Parameter(title: "Title", requestValueDialog: "What should go in your Inbox?")
    var title: String

    init() {}

    init(title: String) {
        self.title = title
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .result(dialog: "Nothing to add.")
        }

        if let host = TempoIntentBridge.host {
            await host.addTodo(title: trimmed)
            IntentLog.logger.info("add (app model): \"\(trimmed, privacy: .public)\"")
            return .result(dialog: "Added to your Inbox.")
        }

        let outcome = await AddTodoStandalone.run(title: trimmed)
        IntentLog.logger.info("add (standalone): \(String(describing: outcome), privacy: .public) \"\(trimmed, privacy: .public)\"")
        switch outcome {
        case .sent, .queued:
            return .result(dialog: "Added to your Inbox.")
        case .signedOut:
            return .result(dialog: "Open Tempo and sign in first.")
        case .rejected:
            return .result(dialog: "Tempo didn't accept that. Open the app to check your sign-in.")
        }
    }
}

enum AddTodoStandalone {
    enum Outcome: Sendable, CustomStringConvertible {
        case sent(UUID)
        case queued(UUID)
        case signedOut
        case rejected

        var description: String {
            switch self {
            case .sent(let id): "sent \(id.uuidString.lowercased())"
            case .queued(let id): "queued \(id.uuidString.lowercased())"
            case .signedOut: "signedOut"
            case .rejected: "rejected"
            }
        }
    }

    /// Short timeouts: Shortcuts shouldn't sit spinning on a bad connection when the inbox
    /// fallback is right there.
    static func run(title: String) async -> Outcome {
        guard let key = TodayWidgetData.apiKey() else { return .signedOut }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 5
        configuration.timeoutIntervalForResource = 8
        configuration.waitsForConnectivity = false
        let session = URLSession(configuration: configuration)
        defer { session.finishTasksAndInvalidate() }

        let client = TempoClient(baseURL: TodayWidgetData.baseURL(), apiKey: key, session: session)
        let draft = TodoDraft(title: title, status: .inbox)
        do {
            _ = try await client.createTodo(draft)
            return .sent(draft.id)
        } catch TempoAPIError.decoding {
            // The server took it and answered with something unexpected; don't create it twice.
            return .sent(draft.id)
        } catch TempoAPIError.unauthorized {
            return .rejected
        } catch TempoAPIError.http(let status, _) where (400..<500).contains(status) {
            return .rejected
        } catch {
            // No network, a timeout, or a server error: the app sends it next time it opens.
            guard let inbox = AppGroup.inboxURL else { return .rejected }
            do {
                try PendingOpInbox(directory: inbox).write(.createTodo(draft: draft))
                return .queued(draft.id)
            } catch {
                IntentLog.logger.error("add: couldn't write to the inbox: \(String(describing: error), privacy: .public)")
                return .rejected
            }
        }
    }
}
