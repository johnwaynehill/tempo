import SwiftUI
import WidgetKit

/// The timer's Live Activity and the Today widget (Home Screen and Lock Screen).
@main
struct TempoWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TempoTimerLiveActivity()
        TodayWidget()
    }
}
