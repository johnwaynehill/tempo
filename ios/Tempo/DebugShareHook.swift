#if DEBUG
import Foundation
import SwiftUI
import UIKit
import os

/// Share-extension checks from the command line, where nothing can tap the simulator.
///
/// - `TEMPO_DEBUG_SHARE="text|url|title"` runs the share extension's `ShareCapture` inside the
///   app process with the key and server stored in the shared Keychain (pair it with
///   `TEMPO_DEBUG_STORE_KEY=1`). Any part may be empty. Logs the outcome, the draft, and the
///   App Group inbox contents in the `debug` category.
/// - `TEMPO_DEBUG_SHARE_PREVIEW=1` presents the share sheet's card over the app with sample
///   data; `saving`, `added`, `queued` or `error` instead of `1` shows that state. Tapping
///   "Add to Inbox" really saves, like the extension.
@MainActor
enum DebugShareHook {
    private static let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "debug")

    static func run() async {
        let env = ProcessInfo.processInfo.environment
        if let raw = env["TEMPO_DEBUG_SHARE"], !raw.isEmpty {
            await share(raw)
        }
        if let state = env["TEMPO_DEBUG_SHARE_PREVIEW"], !state.isEmpty {
            presentPreview(state)
        }
    }

    private static func share(_ raw: String) async {
        let parts = raw.split(separator: "|", maxSplits: 2, omittingEmptySubsequences: false).map(String.init)
        func part(_ i: Int) -> String? { parts.indices.contains(i) && !parts[i].isEmpty ? parts[i] : nil }

        let payload = ShareCapture.Payload(text: part(0), url: part(1).flatMap(URL.init(string:)), title: part(2))
        guard let draft = ShareCapture.draft(for: payload) else {
            log.info("share: nothing to add")
            return
        }
        let server = ShareCapture.storedCredentials()?.baseURL.absoluteString ?? "none (signed out)"
        log.info("share: draft \(draft.id.uuidString, privacy: .public) title=\"\(draft.title, privacy: .public)\" description=\"\(draft.description ?? "", privacy: .public)\" server=\(server, privacy: .public)")

        let outcome = await ShareCapture.save(draft)
        let files = AppGroup.inboxURL.flatMap {
            try? FileManager.default.contentsOfDirectory(atPath: $0.path)
        } ?? []
        log.info("share: outcome=\(String(describing: outcome), privacy: .public) \"\(outcome.message, privacy: .public)\" inbox=\(files.sorted().joined(separator: ","), privacy: .public)")
    }

    private static func presentPreview(_ state: String) {
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first,
              var top = scene.keyWindow?.rootViewController else {
            log.info("share-preview: no window to present on")
            return
        }
        while let presented = top.presentedViewController { top = presented }

        let model = ShareCardModel()
        let host = UIHostingController(rootView: ShareCardView(model: model))
        host.view.backgroundColor = .clear
        host.modalPresentationStyle = .overFullScreen
        host.modalTransitionStyle = .crossDissolve
        model.onFinish = { [weak host] _ in host?.dismiss(animated: true) }
        model.load(ShareCapture.Payload(
            text: nil,
            url: URL(string: "https://www.example.com/articles/single-tasking"),
            title: "The quiet case for single-tasking"
        ))
        model.showPreviewState(state)
        top.present(host, animated: false)
        log.info("share-preview: presented state=\(state, privacy: .public)")
    }
}
#endif
