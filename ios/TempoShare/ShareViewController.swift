import UIKit

/// Placeholder so the TempoShare target builds; the share sheet UI replaces this.
final class ShareViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        extensionContext?.completeRequest(returningItems: nil)
    }
}
