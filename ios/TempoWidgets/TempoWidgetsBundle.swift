import SwiftUI
import WidgetKit

/// Just the timer's Live Activity for now; Home Screen widgets arrive in Phase 3.
@main
struct TempoWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TempoTimerLiveActivity()
    }
}
