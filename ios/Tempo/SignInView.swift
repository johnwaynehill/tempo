import SwiftUI

struct SignInView: View {
    @Environment(Session.self) private var session

    @State private var key = ""
    @State private var isVerifying = false
    @State private var isSigningInWithGoogle = false
    @State private var errorMessage: String?
    @State private var showKeyEntry = false
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

                Text(showKeyEntry
                    ? "Paste an API key from Settings → API Keys on the web app."
                    : "Sign in with the Google account you use for Tempo on the web.")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .lineSpacing(4)

                if let errorMessage {
                    Text(errorMessage)
                        .font(Theme.font(.footnote))
                        .foregroundStyle(Theme.error)
                        .transition(.opacity)
                }

                if showKeyEntry {
                    keyEntry
                } else {
                    googleButton
                }

                Button(showKeyEntry ? "Sign in with Google instead" : "Use an API key instead") {
                    withAnimation(.easeOut(duration: 0.2)) {
                        showKeyEntry.toggle()
                        errorMessage = nil
                    }
                }
                .font(Theme.font(.footnote, weight: .medium))
                .foregroundStyle(Theme.onSurfaceVariant)
                .disabled(isVerifying || isSigningInWithGoogle)

                Spacer()
            }
            .padding(.horizontal, Theme.grid * 3)
            .frame(maxWidth: 480)
        }
        .animation(.easeOut(duration: 0.3), value: errorMessage)
        .onChange(of: key) { _, _ in errorMessage = nil }
    }

    private var googleButton: some View {
        Button(action: submitGoogle) {
            ZStack {
                HStack(spacing: Theme.grid) {
                    Image(systemName: "g.circle.fill")
                        .font(.system(size: 18))
                    Text("Sign in with Google")
                        .font(Theme.font(.body, weight: .semibold))
                }
                .opacity(isSigningInWithGoogle ? 0 : 1)
                if isSigningInWithGoogle {
                    ProgressView()
                        .tint(Theme.onPrimary)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: Theme.grid * 6)
        }
        .buttonStyle(PrimaryButtonStyle())
        .disabled(isSigningInWithGoogle)
    }

    private var keyEntry: some View {
        VStack(alignment: .leading, spacing: Theme.grid * 3) {
            VStack(alignment: .leading, spacing: Theme.grid) {
                TextField("tempo_…", text: $key)
                    .font(Theme.mono(size: 17))
                    .foregroundStyle(Theme.onSurface)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(nil)
                    .keyboardType(.asciiCapable)
                    .submitLabel(.go)
                    .focused($keyFocused)
                    .onSubmit { if looksLikeKey { submitKey() } }
                    .padding(.vertical, Theme.grid * 1.5)
                    .padding(.horizontal, Theme.grid * 2)
                    .background(
                        Theme.surfaceContainerLow,
                        in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                    )
                    .disabled(isVerifying)
            }

            Button(action: submitKey) {
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
        }
    }

    private func submitKey() {
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

    private func submitGoogle() {
        guard !isSigningInWithGoogle, let presenter = Self.topViewController() else { return }
        isSigningInWithGoogle = true
        errorMessage = nil
        Task {
            do {
                try await session.signInWithGoogle(presenting: presenter)
            } catch SignInError.googleCancelled {
                // The user backed out of the account picker; nothing went wrong.
            } catch {
                errorMessage = error.localizedDescription
            }
            isSigningInWithGoogle = false
        }
    }

    /// Google Sign-In needs a `UIViewController` to present its account picker from; SwiftUI
    /// has no view of its own to hand it, so this walks down from the key window's root.
    private static func topViewController(from base: UIViewController? = nil) -> UIViewController? {
        let base = base ?? UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first?.rootViewController
        if let nav = base as? UINavigationController { return topViewController(from: nav.visibleViewController) }
        if let tab = base as? UITabBarController, let selected = tab.selectedViewController { return topViewController(from: selected) }
        if let presented = base?.presentedViewController { return topViewController(from: presented) }
        return base
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
