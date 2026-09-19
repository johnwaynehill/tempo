import SwiftUI
import WidgetKit

/// The timer's Live Activity, the Today widget (Home Screen and Lock Screen), and the
/// Control Center / Lock Screen controls.
@main
struct TempoWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TempoTimerLiveActivity()
        TodayWidget()
        StartNextControl()
        CompleteActiveControl()
    }
}
