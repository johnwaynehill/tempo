import SwiftUI

@main
struct TempoApp: App {
    @State private var session = Session()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
        }
    }
}

/// Switches between sign-in and the app proper based on whether a key is stored.
private struct RootView: View {
    @Environment(Session.self) private var session

    var body: some View {
        Group {
            if session.isSignedIn {
                NavigationStack {
                    TodayView()
                }
            } else {
                SignInView()
            }
        }
        .tint(Theme.primary)
        .animation(.easeOut(duration: 0.3), value: session.isSignedIn)
    }
}
