import Observation
import SwiftUI
import TempoKit

/// State for the share card: the payload, the editable title, and where the save got to.
@Observable @MainActor
final class ShareCardModel {
    enum Phase: Equatable {
        case loading
        case editing
        case saving
        case finished(ShareCapture.Outcome)
    }

    private(set) var payload = ShareCapture.Payload()
    private(set) var phase: Phase = .loading
    /// Inline message in the error colour; nil when there is nothing to say.
    private(set) var errorMessage: String?
    var title = ""

    /// Called once with `true` after a save, `false` on Cancel.
    var onFinish: ((Bool) -> Void)?

    /// One id for this share, so a retry after "sign in first" or a queued copy is the same todo.
    private let draftId = UUID()

    var link: String? { payload.url?.absoluteString }

    var canSave: Bool {
        guard phase == .editing else { return false }
        return !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func load(_ payload: ShareCapture.Payload) {
        self.payload = payload
        title = ShareCapture.suggestedTitle(for: payload)
        phase = .editing
        if payload.isEmpty { errorMessage = "There's nothing here to add." }
    }

    func save() {
        guard canSave, let draft = ShareCapture.draft(for: payload, title: title, id: draftId) else { return }
        errorMessage = nil
        phase = .saving
        Task {
            let outcome = await ShareCapture.save(draft)
            if outcome.isSuccess {
                phase = .finished(outcome)
                try? await Task.sleep(for: .milliseconds(800))
                onFinish?(true)
            } else {
                errorMessage = outcome.message
                phase = .editing
            }
        }
    }

    #if DEBUG
    /// Puts the card in a given state for screenshots (`TEMPO_DEBUG_SHARE_PREVIEW`).
    func showPreviewState(_ state: String) {
        switch state {
        case "saving": phase = .saving
        case "added": phase = .finished(.added)
        case "queued": phase = .finished(.queued)
        case "error": errorMessage = ShareCapture.Outcome.keyRejected.message
        default: break
        }
    }
    #endif

    func cancel() {
        guard phase != .saving else { return }
        onFinish?(false)
    }
}

/// The compact "Add to Tempo" card, shown by the share extension (and by the app's DEBUG
/// `TEMPO_DEBUG_SHARE_PREVIEW`, which is why it lives in Shared). Quiet Rhythm: no borders, hierarchy from the surface
/// ramp, sage primary. System font (extensions can't load the app's bundled faces), sized
/// by text style so Dynamic Type applies.
struct ShareCardView: View {
    let model: ShareCardModel

    @FocusState private var titleFocused: Bool
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack {
            card
                .padding(.horizontal, 16)
                .padding(.top, 16)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.opacity(colorScheme == .dark ? 0.35 : 0.18).ignoresSafeArea())
        .animation(.easeOut(duration: 0.3), value: model.phase)
        .animation(.easeOut(duration: 0.3), value: model.errorMessage)
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Add to Tempo")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(WidgetTheme.onSurfaceVariant)
                .accessibilityAddTraits(.isHeader)

            if case .finished(let outcome) = model.phase {
                confirmation(outcome)
            } else {
                form
            }
        }
        .padding(24)
        .frame(maxWidth: 560, alignment: .leading)
        .background(WidgetTheme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: WidgetTheme.onSurface.opacity(0.08), radius: 24, y: 8)
    }

    @ViewBuilder
    private var form: some View {
        VStack(alignment: .leading, spacing: 8) {
            @Bindable var model = model
            TextField("What's this about?", text: $model.title, axis: .vertical)
                .font(.body)
                .foregroundStyle(WidgetTheme.onSurface)
                .tint(WidgetTheme.primary)
                .lineLimit(1...4)
                .submitLabel(.done)
                .focused($titleFocused)
                .disabled(model.phase == .saving)
                .onSubmit { model.save() }
                .padding(.vertical, 12)
                .padding(.horizontal, 16)
                .background(ShareColors.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .accessibilityLabel("Title")

            if let link = model.link {
                Text(link)
                    .font(.footnote)
                    .foregroundStyle(WidgetTheme.onSurfaceVariant)
                    .lineLimit(2)
                    .truncationMode(.middle)
                    .padding(.horizontal, 4)
                    .accessibilityLabel("Link, \(link)")
            }

            if let message = model.errorMessage {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(ShareColors.error)
                    .padding(.horizontal, 4)
                    .transition(.opacity)
            }
        }
        .onChange(of: model.phase, initial: true) { _, phase in
            if phase == .editing { titleFocused = true }
        }

        HStack(spacing: 12) {
            Button("Cancel", action: model.cancel)
                .buttonStyle(ShareButtonStyle(prominent: false))
                .disabled(model.phase == .saving)

            Button(action: model.save) {
                ZStack {
                    Text("Add to Inbox").opacity(model.phase == .saving ? 0 : 1)
                    if model.phase == .saving {
                        ProgressView().tint(WidgetTheme.onPrimary)
                    }
                }
            }
            .buttonStyle(ShareButtonStyle(prominent: true))
            .disabled(!model.canSave)
            .accessibilityLabel(model.phase == .saving ? "Adding" : "Add to Inbox")
        }
    }

    private func confirmation(_ outcome: ShareCapture.Outcome) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: "checkmark")
                .font(.body.weight(.semibold))
                .foregroundStyle(WidgetTheme.primary)
            Text(outcome.message)
                .font(.body)
                .foregroundStyle(WidgetTheme.onSurface)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 8)
        .transition(.opacity)
        .accessibilityElement(children: .combine)
    }
}

private struct ShareButtonStyle: ButtonStyle {
    let prominent: Bool
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(prominent ? .semibold : .regular))
            .foregroundStyle(prominent ? WidgetTheme.onPrimary : WidgetTheme.onSurface)
            .frame(maxWidth: .infinity, minHeight: 48)
            .padding(.horizontal, 16)
            .background {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(prominent
                          ? AnyShapeStyle(LinearGradient(colors: [WidgetTheme.primary, WidgetTheme.primaryDim],
                                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                          : AnyShapeStyle(WidgetTheme.surfaceContainerHigh))
            }
            .opacity(isEnabled ? (configuration.isPressed ? 0.85 : 1) : 0.5)
            .animation(.easeOut(duration: 0.2), value: configuration.isPressed)
    }
}

/// Tokens the card needs that `WidgetTheme` doesn't carry; hex values from `Tempo/Theme.swift`.
private enum ShareColors {
    static let surfaceContainerLow = adaptive(light: 0xF3F4F3, dark: 0x1F2120)
    static let error = adaptive(light: 0xA83836, dark: 0xE5726F)

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { trait in
            let hex = trait.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: 1
            )
        })
    }
}
