import SwiftUI
import TempoKit

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
    @Environment(\.scenePhase) private var scenePhase
    @State private var model: AppModel?

    var body: some View {
        Group {
            if session.isSignedIn, let model {
                MainTabs()
                    .environment(model)
            } else if session.isSignedIn {
                Theme.surface.ignoresSafeArea()
            } else {
                SignInView()
            }
        }
        .tint(Theme.primary)
        .animation(.easeOut(duration: 0.3), value: session.isSignedIn)
        .onChange(of: session.apiKey, initial: true) { _, _ in
            // One model per signed-in key; signing out drops it and its data.
            if let client = session.client, let key = session.apiKey {
                model = AppModel(client: client, apiKey: key)
            } else {
                model = nil
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // Back in the foreground: send what's queued, then pull what changed.
            guard phase == .active, let model else { return }
            Task { await model.activate() }
        }
    }
}

/// The web's bottom nav: Today, Inbox, Backlog, Habits. Each tab keeps its own stack.
private struct MainTabs: View {
    enum Tab: Hashable { case today, inbox, backlog, habits }

    @State private var selection: Tab = .today

    var body: some View {
        TabView(selection: $selection) {
            SwiftUI.Tab("Today", systemImage: "circle.circle", value: Tab.today) {
                TabStack { TodayView() }
            }
            SwiftUI.Tab("Inbox", systemImage: "arrow.down", value: Tab.inbox) {
                TabStack { InboxView() }
            }
            SwiftUI.Tab("Backlog", systemImage: "list.bullet", value: Tab.backlog) {
                TabStack { BacklogView() }
            }
            SwiftUI.Tab("Habits", systemImage: "arrow.trianglehead.2.clockwise", value: Tab.habits) {
                TabStack { HabitsView() }
            }
        }
    }
}

/// A navigation stack that knows how to push a todo detail from any row.
private struct TabStack<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        NavigationStack {
            content
                .navigationDestination(for: UUID.self) { id in
                    TodoDetailView(id: id)
                }
        }
    }
}
