import AppIntents
import SwiftUI
import WidgetKit

/// Control Center / Lock Screen controls (iOS 18+), added from Control Center's own "Add a
/// Control" editor or a Lock Screen's edit sheet. Each just runs the same intent the widget's
/// buttons and the "Start next task" / "Complete task" Shortcuts already run — no new logic,
/// no capability beyond what a free personal team can already sign (unlike Siri or push).
struct StartNextControl: ControlWidget {
    static let kind = "com.johnwaynehill.Tempo.StartNext"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: StartNextTaskIntent()) {
                Label("Start Next Task", systemImage: "play.fill")
            }
        }
        .displayName("Start Next Task")
        .description("Starts the timer on today's first task.")
    }
}

struct CompleteActiveControl: ControlWidget {
    static let kind = "com.johnwaynehill.Tempo.CompleteActive"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: CompleteActiveTaskIntent()) {
                Label("Complete Task", systemImage: "checkmark")
            }
        }
        .displayName("Complete Task")
        .description("Completes whatever's on the clock right now.")
    }
}
