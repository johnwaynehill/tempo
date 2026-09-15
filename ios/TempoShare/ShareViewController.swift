import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// The share sheet's principal class: reads what was shared, hosts the SwiftUI card, and
/// finishes the request when the card is done.
final class ShareViewController: UIViewController {
    private let model = ShareCardModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        model.onFinish = { [weak self] saved in
            guard let context = self?.extensionContext else { return }
            if saved {
                context.completeRequest(returningItems: nil)
            } else {
                context.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError))
            }
        }

        let host = UIHostingController(rootView: ShareCardView(model: model))
        host.view.backgroundColor = .clear
        host.sizingOptions = []
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        host.didMove(toParent: self)

        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        Task { @MainActor [model] in
            model.load(await Self.payload(from: items))
        }
    }

    /// Collects the first link, any plain text, and Safari's title/content strings.
    private static func payload(from items: [NSExtensionItem]) async -> ShareCapture.Payload {
        var title: String?
        var contentText: String?
        var urls: [URL] = []
        var texts: [String] = []

        for item in items {
            if title == nil { title = item.attributedTitle?.string }
            if contentText == nil { contentText = item.attributedContentText?.string }
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                   let url = await loadURL(provider) {
                    urls.append(url)
                } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                          let text = await loadText(provider) {
                    texts.append(text)
                }
            }
        }
        return .fromExtensionItem(title: title, contentText: contentText, urls: urls, texts: texts)
    }

    private static func loadURL(_ provider: NSItemProvider) async -> URL? {
        guard let item = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) else { return nil }
        switch item {
        case let url as URL: return url
        case let data as Data: return URL(dataRepresentation: data, relativeTo: nil)
        case let string as String: return URL(string: string)
        default: return nil
        }
    }

    private static func loadText(_ provider: NSItemProvider) async -> String? {
        guard let item = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) else { return nil }
        switch item {
        case let string as String: return string
        case let attributed as NSAttributedString: return attributed.string
        case let data as Data: return String(data: data, encoding: .utf8)
        default: return nil
        }
    }
}
