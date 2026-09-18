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
                ZStack {
                    MainTabs()
                        .environment(model)
                    #if DEBUG
                    if IntentDebugLaunch.showsWidgetGallery {
                        WidgetGalleryView()
                    }
                    #endif
                }
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
                let created = AppModel(client: client, apiKey: key)
                model = created
                registerIntentHost(created)
            } else {
                model = nil
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // Back in the foreground: send what's queued, then pull what changed.
            guard phase == .active, let model else { return }
            Task { await model.activate() }
        }
        #if DEBUG
        .onChange(of: scenePhase, initial: true) { _, phase in
            // Not just .active: a system alert (the first-launch notification prompt) holds the scene inactive.
            guard phase != .background, let model else { return }
            IntentDebugLaunch.runIfRequested(host: model) { await model.activate() }
        }
        #endif
    }

    /// App Intents running in this process go through the live model instead of the App Group.
    private func registerIntentHost(_ model: AppModel) {
        #if DEBUG
        // TEMPO_DEBUG_RUN_INTENT runs its intent with no host first, as if the app weren't running.
        if IntentDebugLaunch.holdsHost { return }
        #endif
        TempoIntentBridge.host = model
    }
}

/// The web's bottom nav: Today, Inbox, Backlog, Habits, plus a More tab for everything
/// below the fold (Plan My Day, Playlists, Notes, Insights, Weekly Review, Settings).
private struct MainTabs: View {
    enum Tab: Hashable { case today, inbox, backlog, habits, more }

    @Environment(AppModel.self) private var model
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
            SwiftUI.Tab("More", systemImage: "ellipsis", value: Tab.more) {
                TabStack { MoreView() }
            }
        }
        // Start focus (App Intent) opens Focus Mode from Today.
        .onChange(of: model.focusRequested) { _, requested in
            if requested { selection = .today }
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
