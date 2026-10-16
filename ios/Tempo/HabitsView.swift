import SwiftUI
import TempoKit

/// Today's check-ins. Mirrors `Habits.tsx` / `HabitRow.tsx`: one big circle to tap,
/// the name, the streak, and the last seven days as dots (today rightmost).
struct HabitsView: View {
    @Environment(AppModel.self) private var model
    @State private var showNew = false

    private var habits: [Habit] { model.activeHabits }
    private var today: String { model.todayString }
    private var completedToday: Int { habits.filter { $0.isCompleted(on: today) }.count }

    var body: some View {
        List {
            PageHeader(
                title: "Habits",
                subtitle: habits.isEmpty ? nil : "\(completedToday) of \(habits.count) done today"
            )
            .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            if let error = model.error, model.hasLoaded {
                Text(error)
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.error)
                    .plainRow(bottom: Theme.grid)
            }

            if !model.hasLoaded {
                HStack { Spacer(); ProgressView().tint(Theme.onSurfaceVariant); Spacer() }
                    .plainRow(top: Theme.grid * 8)
            } else if habits.isEmpty {
                EmptyState(symbol: "plus", title: "No habits yet", message: "Start small — even one is a win. Tap + to add one.")
                    .plainRow()
            } else {
                ForEach(habits) { habit in
                    HabitRow(habit: habit, today: today, calendar: model.calendar) { completed in
                        Task { await model.toggleHabit(id: habit.id, date: today, completed: completed) }
                    }
                    .navigates { HabitDetailView(habitId: habit.id) }
                    .cardRow()
                }

                if completedToday == habits.count {
                    EmptyState(symbol: "checkmark", title: "All habits done", message: "Consistency is the goal, not perfection.")
                        .padding(.vertical, -Theme.grid * 6)
                        .plainRow(top: Theme.grid * 2)
                }

                SectionLabel(text: "Activity")
                    .plainRow(top: Theme.grid * 3, bottom: Theme.grid)
                VStack(alignment: .trailing, spacing: Theme.grid * 1.5) {
                    HabitActivityGrid(habits: habits, calendar: model.calendar)
                    HStack(spacing: 4) {
                        Text("Less")
                        ForEach(0..<4, id: \.self) { level in
                            RoundedRectangle(cornerRadius: 2, style: .continuous)
                                .fill(HabitActivityGrid.levelColor(level))
                                .frame(width: 10, height: 10)
                        }
                        Text("More")
                    }
                    .font(Theme.font(size: 10))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.6))
                    .accessibilityHidden(true)
                }
                .padding(Theme.grid * 2)
                .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
                .cardRow()
            }
        }
        .tempoList()
        .animation(.easeOut(duration: 0.3), value: completedToday)
        .sensoryFeedback(.success, trigger: completedToday) { old, new in new > old }
        .refreshable { await model.reload() }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showNew = true } label: {
                    Image(systemName: "plus").foregroundStyle(Theme.onSurfaceVariant)
                }
                .accessibilityLabel("New habit")
            }
        }
        .sheet(isPresented: $showNew) {
            HabitEditorSheet()
                .presentationDetents([.height(260)])
        }
        .toolbarTitleDisplayMode(.inline)
        .task { await model.loadIfNeeded() }
    }
}

private struct HabitRow: View {
    let habit: Habit
    let today: String
    let calendar: Calendar
    var onToggle: (Bool) -> Void

    private var isDoneToday: Bool { habit.isCompleted(on: today) }

    /// The last seven days as `yyyy-MM-dd`, oldest first, so today lands on the right.
    private var week: [String] {
        let now = Date()
        return (0..<7).reversed().map { offset in
            DayMath.isoDateString(DayMath.adding(days: -offset, to: now, calendar: calendar), calendar: calendar)
        }
    }

    private var streak: Int {
        let completions = habit.completions
            .filter { $0.value }
            .compactMap { Self.parseDay($0.key, calendar: calendar) }
        return Streaks.currentStreak(completions: completions, calendar: calendar).currentStreak
    }

    var body: some View {
        HStack(spacing: Theme.grid * 2) {
            Button {
                onToggle(!isDoneToday)
            } label: {
                ZStack {
                    Circle()
                        .fill(isDoneToday ? Theme.primary : Theme.surfaceContainerHigh)
                        .frame(width: 44, height: 44)
                    Image(systemName: "checkmark")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Theme.onPrimary)
                        .opacity(isDoneToday ? 1 : 0)
                        .scaleEffect(isDoneToday ? 1 : 0.6)
                }
                .animation(.easeOut(duration: 0.3), value: isDoneToday)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isDoneToday ? "Mark \(habit.name) incomplete" : "Mark \(habit.name) complete")

            VStack(alignment: .leading, spacing: 4) {
                Text(habit.name)
                    .font(Theme.font(size: 15, weight: .medium))
                    .foregroundStyle(Theme.onSurface)
                    .lineLimit(2)
                Text(streak > 0 ? "\(streak) day streak" : "No streak yet")
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .monospacedDigit()
            }

            Spacer(minLength: Theme.grid)

            HStack(spacing: 4) {
                ForEach(week, id: \.self) { day in
                    Circle()
                        .fill(habit.isCompleted(on: day) ? Theme.primary : Theme.surfaceContainerHigh)
                        .frame(width: 8, height: 8)
                }
            }
            .accessibilityLabel("Last seven days: \(week.filter { habit.isCompleted(on: $0) }.count) of 7")
        }
        .padding(Theme.grid * 2)
        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }

    private static func parseDay(_ key: String, calendar: Calendar) -> Date? {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        components.hour = 12
        return calendar.date(from: components)
    }
}
