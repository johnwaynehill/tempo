import AppIntents

/// Phrases Siri and Spotlight offer without any setup. App Shortcuts don't need the Siri
/// capability, which free personal teams can't use.
struct TempoShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartNextTaskIntent(),
            phrases: [
                "Start next task in \(.applicationName)",
                "Start my next \(.applicationName) task",
            ],
            shortTitle: "Start Next Task",
            systemImageName: "play.fill"
        )
        AppShortcut(
            intent: AddTodoIntent(),
            phrases: [
                "Add to \(.applicationName)",
                "Add a todo to \(.applicationName)",
            ],
            shortTitle: "Add to Tempo",
            systemImageName: "tray.and.arrow.down"
        )
        AppShortcut(
            intent: WhatsOnTodayIntent(),
            phrases: [
                "What's on Today in \(.applicationName)",
                "What's on my \(.applicationName) today",
            ],
            shortTitle: "What's on Today",
            systemImageName: "sun.horizon"
        )
        AppShortcut(
            intent: StartFocusIntent(),
            phrases: [
                "Start focus in \(.applicationName)",
                "Focus with \(.applicationName)",
            ],
            shortTitle: "Start Focus",
            systemImageName: "target"
        )
    }

    static let shortcutTileColor: ShortcutTileColor = .teal
}
