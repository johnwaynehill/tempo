import SwiftUI
import TempoKit
import WidgetKit

/// The Habits widget's views, shared by the widget extension and the app's DEBUG widget
/// gallery. Each row is its own tappable circle — no navigation, no app launch — mirroring
/// `HabitsView`'s `HabitRow` at widget scale.
struct HabitsWidgetView<Toggle: View>: View {
    let entry: HabitsWidgetEntry
    let family: WidgetFamily
    /// Builds the row's toggle button given the habit's id and its *current* completion state.
    let toggle: (UUID, Bool) -> Toggle

    init(entry: HabitsWidgetEntry, family: WidgetFamily, @ViewBuilder toggle: @escaping (UUID, Bool) -> Toggle) {
        self.entry = entry
        self.family = family
        self.toggle = toggle
    }

    private var maxRows: Int { family == .systemSmall ? 3 : 5 }

    var body: some View {
        switch entry.content {
        case .habits(let habits):
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center) {
                    WidgetLabel(text: "Habits")
                    Spacer(minLength: 8)
                    Text("\(habits.filter(\.completedToday).count)/\(habits.count)")
                        .font(.system(size: 12, weight: .medium))
                        .monospacedDigit()
                        .foregroundStyle(WidgetTheme.onSurfaceVariant)
                }
                .frame(height: 20)

                VStack(alignment: .leading, spacing: 10) {
                    ForEach(habits.prefix(maxRows)) { habit in
                        row(habit)
                    }
                }
                .padding(.top, 10)

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        case .empty:
            quiet(title: "No habits yet", message: "Add one in Tempo to see it here.")
        case .notLoaded:
            quiet(title: "Almost ready", message: "Open Tempo to load your habits.")
        case .signedOut:
            quiet(title: "Tempo", message: "Open Tempo to sign in.")
        }
    }

    private func row(_ habit: HabitsWidgetHabit) -> some View {
        HStack(spacing: 10) {
            toggle(habit.id, habit.completedToday)
                .frame(width: 24, height: 24)

            Text(habit.name)
                .font(.system(size: 14))
                .foregroundStyle(WidgetTheme.onSurface)
                .lineLimit(1)
                .strikethrough(habit.completedToday, color: WidgetTheme.onSurfaceVariant)

            Spacer(minLength: 4)

            if family != .systemSmall, habit.streak > 0 {
                Text("\(habit.streak)d")
                    .font(.system(size: 12))
                    .monospacedDigit()
                    .foregroundStyle(WidgetTheme.onSurfaceVariant)
            }
        }
    }

    private func quiet(title: String, message: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            WidgetLabel(text: "Habits")
            Spacer(minLength: 8)
            Text(title)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(WidgetTheme.onSurface)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(WidgetTheme.onSurfaceVariant)
                .lineLimit(2)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// One habit's toggle circle: filled sage with a checkmark when done today, an outline
/// otherwise. The label reflects the tap's *result*, matching `HabitRow`'s accessibility text.
struct HabitToggleCircle: View {
    let completedToday: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(completedToday ? WidgetTheme.primary : WidgetTheme.surfaceContainerHigh)
            if completedToday {
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(WidgetTheme.onPrimary)
            }
        }
    }
}

/// Small uppercase section label, matching `TodayWidgetViews`' own private copy — kept here
/// too since this file has no dependency on that one.
private struct WidgetLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .tracking(1)
            .textCase(.uppercase)
            .foregroundStyle(WidgetTheme.onSurfaceVariant)
    }
}
