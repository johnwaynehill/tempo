import SwiftUI
import TempoKit

/// One habit in depth. Mirrors `HabitDetail.tsx`: today's check-in, streak / total / rate / since,
/// a 16-week activity grid, and the last 30 days — each day tappable, so a missed check-in can be
/// filled in after the fact — plus edit and delete.
struct HabitDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let habitId: UUID

    @State private var showEdit = false
    @State private var confirmDelete = false

    var body: some View {
        Group {
            if let habit = model.habit(id: habitId) {
                content(habit)
            } else {
                // Deleted (here or elsewhere): nothing to show, so step back.
                Color.clear.onAppear { dismiss() }
            }
        }
        .background(Theme.surface)
        .toolbarTitleDisplayMode(.inline)
    }

    private func content(_ habit: Habit) -> some View {
        let calendar = model.calendar
        let today = model.todayString
        let stats = HabitStatsCalculator.stats(for: habit, calendar: calendar)
        let doneToday = habit.isCompleted(on: today)

        return ScrollView {
            VStack(alignment: .leading, spacing: Theme.grid * 3) {
                HStack(alignment: .top, spacing: Theme.grid * 2) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(habit.name)
                            .font(Theme.display(.title))
                            .foregroundStyle(Theme.onSurface)
                        if let description = habit.description, !description.isEmpty {
                            Text(description)
                                .font(Theme.font(.subheadline))
                                .foregroundStyle(Theme.onSurfaceVariant)
                        }
                    }
                    Spacer()
                    Button {
                        Task { await model.toggleHabit(id: habit.id, date: today, completed: !doneToday) }
                    } label: {
                        ZStack {
                            Circle().fill(doneToday ? Theme.primary : Theme.surfaceContainerHigh)
                            if doneToday {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundStyle(Theme.onPrimary)
                            }
                        }
                        .frame(width: 48, height: 48)
                    }
                    .buttonStyle(.plain)
                    .sensoryFeedback(.success, trigger: doneToday) { _, new in new }
                    .accessibilityLabel(doneToday ? "Mark today not done" : "Mark today done")
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.grid * 1.5) {
                    StatCard(
                        title: "Streak",
                        value: stats.currentStreak > 0 ? "\(stats.currentStreak)d" : "—",
                        subtitle: stats.bestStreak > stats.currentStreak ? "best: \(stats.bestStreak)d" : "current"
                    )
                    StatCard(title: "Total", value: "\(stats.totalCompletions)", subtitle: stats.totalCompletions == 1 ? "day" : "days")
                    StatCard(title: "Rate", value: "\(stats.completionRate)%", subtitle: "completion")
                    StatCard(
                        title: "Since",
                        value: habit.createdAt.formatted(.dateTime.month(.abbreviated).day()),
                        subtitle: habit.createdAt.formatted(.dateTime.year())
                    )
                }

                VStack(alignment: .leading, spacing: Theme.grid * 1.5) {
                    SectionLabel(text: "Activity")
                    HabitActivityGrid(habit: habit, calendar: calendar)
                        .padding(Theme.grid * 2)
                        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
                }

                VStack(alignment: .leading, spacing: Theme.grid * 1.5) {
                    SectionLabel(text: "Last 30 days")
                    VStack(spacing: 0) {
                        ForEach(0..<30, id: \.self) { offset in
                            let day = DayMath.adding(days: -offset, to: Date(), calendar: calendar)
                            let key = DayMath.isoDateString(day, calendar: calendar)
                            let done = habit.isCompleted(on: key)
                            Button {
                                Task { await model.toggleHabit(id: habit.id, date: key, completed: !done) }
                            } label: {
                                HStack {
                                    Text(offset == 0 ? "Today" : offset == 1 ? "Yesterday" : day.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
                                        .font(Theme.font(.subheadline))
                                        .foregroundStyle(Theme.onSurface)
                                    Spacer()
                                    Text(done ? "Done" : "—")
                                        .font(Theme.font(.caption, weight: .medium))
                                        .foregroundStyle(done ? Theme.primary : Theme.onSurfaceVariant.opacity(0.4))
                                }
                                .padding(.horizontal, Theme.grid * 2)
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(key), \(done ? "done" : "not done")")
                            if offset < 29 { Divider().overlay(Theme.outlineVariant.opacity(0.15)) }
                        }
                    }
                    .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
                }

                VStack(spacing: Theme.grid) {
                    actionRow(title: "Edit habit", subtitle: "Change name or description", destructive: false) { showEdit = true }
                    actionRow(title: "Delete habit", subtitle: "Permanently remove this habit and all history", destructive: true) { confirmDelete = true }
                }
            }
            .padding(.horizontal, Theme.grid * 2)
            .padding(.top, Theme.grid)
            .padding(.bottom, Theme.grid * 4)
        }
        .sheet(isPresented: $showEdit) {
            HabitEditorSheet(habit: habit)
                .presentationDetents([.height(260)])
        }
        .confirmationDialog("Delete \"\(habit.name)\"?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { await model.deleteHabit(id: habit.id) }
            }
        } message: {
            Text("This removes the habit and its whole history.")
        }
    }

    private func actionRow(title: String, subtitle: String, destructive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(Theme.font(.subheadline, weight: .medium))
                    .foregroundStyle(destructive ? Theme.error : Theme.onSurface)
                Text(subtitle)
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.grid * 2)
            .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// 16 weeks of check-ins, oldest column first, Monday at the top — `ContributionGrid.tsx` for one habit.
struct HabitActivityGrid: View {
    let habit: Habit
    let calendar: Calendar

    private var weeks: [[Date?]] {
        let today = DayMath.startOfDay(Date(), calendar: calendar)
        let thisMonday = Insights.startOfWeek(today, calendar: calendar)
        let firstMonday = DayMath.adding(days: -7 * 15, to: thisMonday, calendar: calendar)
        return (0..<16).map { week in
            (0..<7).map { day in
                let date = DayMath.adding(days: week * 7 + day, to: firstMonday, calendar: calendar)
                return date > today ? nil : date
            }
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 3) {
            ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                VStack(spacing: 3) {
                    ForEach(Array(week.enumerated()), id: \.offset) { _, date in
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(color(for: date))
                            .aspectRatio(1, contentMode: .fit)
                    }
                }
            }
        }
        .accessibilityLabel("Last 16 weeks of check-ins")
    }

    private func color(for date: Date?) -> Color {
        guard let date else { return .clear }
        return habit.isCompleted(on: DayMath.isoDateString(date, calendar: calendar)) ? Theme.primary : Theme.surfaceContainerHigh
    }
}
