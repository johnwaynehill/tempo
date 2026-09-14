import SwiftUI

struct SignInView: View {
    @Environment(Session.self) private var session

    @State private var key = ""
    @State private var isVerifying = false
    @State private var errorMessage: String?
    @FocusState private var keyFocused: Bool

    private var looksLikeKey: Bool {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.hasPrefix("tempo_") && trimmed.count > 12
    }

    var body: some View {
        ZStack {
            Theme.surface.ignoresSafeArea()

            VStack(alignment: .leading, spacing: Theme.grid * 3) {
                Spacer(minLength: Theme.grid * 8)

                Text("Tempo")
                    .font(Theme.display(.largeTitle))
                    .foregroundStyle(Theme.primary)
                    .tracking(-0.5)

                Text("Paste an API key from Settings → API Keys on the web app.")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .lineSpacing(4)

                VStack(alignment: .leading, spacing: Theme.grid) {
                    TextField("tempo_…", text: $key)
                        .font(Theme.font(.body, design: .monospaced))
                        .foregroundStyle(Theme.onSurface)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textContentType(nil)
                        .keyboardType(.asciiCapable)
                        .submitLabel(.go)
                        .focused($keyFocused)
                        .onSubmit { if looksLikeKey { submit() } }
                        .padding(.vertical, Theme.grid * 1.5)
                        .padding(.horizontal, Theme.grid * 2)
                        .background(
                            Theme.surfaceContainerLow,
                            in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                        )
                        .disabled(isVerifying)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(Theme.font(.footnote))
                            .foregroundStyle(Theme.error)
                            .transition(.opacity)
                    }
                }

                Button(action: submit) {
                    ZStack {
                        Text("Sign in")
                            .font(Theme.font(.body, weight: .semibold))
                            .opacity(isVerifying ? 0 : 1)
                        if isVerifying {
                            ProgressView()
                                .tint(Theme.onPrimary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: Theme.grid * 6)
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!looksLikeKey || isVerifying)

                Spacer()
            }
            .padding(.horizontal, Theme.grid * 3)
            .frame(maxWidth: 480)
        }
        .animation(.easeOut(duration: 0.3), value: errorMessage)
        .onChange(of: key) { _, _ in errorMessage = nil }
    }

    private func submit() {
        guard looksLikeKey, !isVerifying else { return }
        isVerifying = true
        errorMessage = nil
        keyFocused = false
        Task {
            do {
                try await session.signIn(apiKey: key)
            } catch {
                errorMessage = error.localizedDescription
            }
            isVerifying = false
        }
    }
}

/// Primary action: sage fill, xl rounding, no shadow. Dims rather than flashes when pressed.
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(Theme.onPrimary)
            .background(
                LinearGradient(
                    colors: [Theme.primary, Theme.primaryDim],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 24, style: .continuous)
            )
            .opacity(isEnabled ? (configuration.isPressed ? 0.85 : 1) : 0.4)
            .animation(.easeOut(duration: 0.2), value: configuration.isPressed)
    }
}

#Preview {
    SignInView()
        .environment(Session())
}
