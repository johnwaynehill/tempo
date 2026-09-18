import SwiftUI
import TempoKit

/// Completion stats over a selectable time range. Mirrors `Insights.tsx`: summary cards,
/// on-time %, by-project breakdown, and an activity trend with a daily/weekly/monthly toggle.
struct InsightsView: View {
    @Environment(AppModel.self) private var model

    @State private var timeRange: TimeRange = .thirtyDays
    @State private var trendMode: TrendMode = .daily

    private var range: (start: Date, end: Date) {
        timeRange.range(calendar: model.calendar)
    }

    var body: some View {
        let done = model.todos.filter { $0.status == .done }
        let data = Insights.compute(done: done, range: range, calendar: model.calendar)
        let hasDueDateTodos = data.completedOnTime + data.completedLate > 0
        let onTimePercent = hasDueDateTodos
            ? Double(data.completedOnTime) / Double(data.completedOnTime + data.completedLate) * 100
            : 0
        let trendData = trend(mode: trendMode, data: data)

        List {
            PageHeader(title: "Insights", subtitle: timeRange.subtitle)
                .plainRow(top: Theme.grid, bottom: Theme.grid)

            rangeSelector
                .plainRow(bottom: Theme.grid * 2)

            if data.totalCompleted == 0 {
                EmptyState(
                    symbol: "checkmark",
                    title: "Fresh start",
                    message: "Complete your first task and come back to see your progress."
                )
                .plainRow()
            } else {
                summaryCards(data)
                    .plainRow(bottom: Theme.grid)

                if hasDueDateTodos {
                    SectionLabel(text: "Timeliness")
                        .plainRow(top: Theme.grid, bottom: Theme.grid)
                    timelinessCard(data, onTimePercent: onTimePercent)
                        .plainRow(bottom: Theme.grid)
                }

                if !data.byProject.isEmpty {
                    SectionLabel(text: "By Project")
                        .plainRow(top: Theme.grid, bottom: Theme.grid)
                    byProjectCard(data)
                        .plainRow(bottom: Theme.grid)
                }

                SectionHeaderRow("Activity") { trendModeToggle }
                    .plainRow(top: Theme.grid, bottom: Theme.grid)

                VerticalBarSeries(
                    data: trendData,
                    labelInterval: trendMode == .daily && trendData.count > 14
                        ? Int((Double(trendData.count) / 7).rounded(.up))
                        : nil,
                    highlightLast: true
                )
                .padding(Theme.grid * 2.5)
                .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
                .plainRow(bottom: Theme.grid)

                if let day = data.mostProductiveDay {
                    footerNote(day: day, topProject: data.topProject)
                        .plainRow(top: Theme.grid)
                }
            }
        }
        .tempoList()
        .animation(.easeOut(duration: 0.2), value: timeRange)
        .animation(.easeOut(duration: 0.2), value: trendMode)
        .navigationTitle("")
        .toolbarTitleDisplayMode(.inline)
        .task { await model.loadIfNeeded() }
    }

    // MARK: Sections

    private func summaryCards(_ data: InsightsData) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Theme.grid * 1.5), count: 3), spacing: Theme.grid * 1.5) {
            StatCard(
                title: "Completed",
                value: "\(data.totalCompleted)",
                subtitle: "task\(data.totalCompleted != 1 ? "s" : "") completed",
                accent: true
            )
            StatCard(
                title: "Streak",
                value: data.currentStreak > 0 ? "\(data.currentStreak)d" : "\u{2014}",
                subtitle: streakSubtitle(data)
            )
            StatCard(
                title: "Pace",
                value: paceValue(data),
                subtitle: "per day average"
            )
        }
    }

    private func timelinessCard(_ data: InsightsData, onTimePercent: Double) -> some View {
        HStack(spacing: Theme.grid * 3) {
            ProgressRing(value: onTimePercent)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(Int(onTimePercent.rounded()))% on time")
                    .font(Theme.display(.title3))
                    .foregroundStyle(Theme.onSurface)
                Text("\(data.completedOnTime) on time \u{00B7} \(data.completedLate) after due date")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
            Spacer(minLength: 0)
        }
        .padding(Theme.grid * 2.5)
        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }

    private func byProjectCard(_ data: InsightsData) -> some View {
        HorizontalBarChart(data: data.byProject.map { .init(label: $0.project, value: $0.count) })
            .padding(Theme.grid * 2.5)
            .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }

    private func footerNote(day: String, topProject: String?) -> some View {
        var text = "Most productive day: \(day)"
        if let topProject, topProject != "Ungrouped" {
            text += " \u{00B7} Top project: \(topProject)"
        }
        return Text(text)
            .font(Theme.font(.caption2))
            .foregroundStyle(Theme.onSurfaceVariant.opacity(0.6))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
    }

    // MARK: Controls

    private var rangeSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.grid) {
                ForEach(TimeRange.allCases, id: \.self) { option in
                    PillButton(title: option.label, isSelected: timeRange == option) {
                        timeRange = option
                    }
                }
            }
        }
    }

    private var trendModeToggle: some View {
        HStack(spacing: 4) {
            ForEach(TrendMode.allCases, id: \.self) { mode in
                PillButton(title: mode.label, isSelected: trendMode == mode, compact: true) {
                    trendMode = mode
                }
            }
        }
    }

    private func streakSubtitle(_ data: InsightsData) -> String {
        guard data.currentStreak > 0 else { return "Complete a task today to start" }
        var text = "day streak"
        if data.bestStreak > data.currentStreak { text += " \u{00B7} best: \(data.bestStreak)d" }
        return text
    }

    private func paceValue(_ data: InsightsData) -> String {
        let formatted = String(format: "%.1f", data.avgPerDay)
        return data.avgPerDay >= 1 ? formatted : "~\(formatted)"
    }

    private func trend(mode: TrendMode, data: InsightsData) -> [TrendPoint] {
        switch mode {
        case .daily: data.dailyTrend
        case .weekly: data.weeklyTrend
        case .monthly: data.monthlyTrend
        }
    }
}

// MARK: - Time range

enum TimeRange: CaseIterable, Hashable {
    case sevenDays, thirtyDays, ninetyDays, allTime

    var label: String {
        switch self {
        case .sevenDays: "7 days"
        case .thirtyDays: "30 days"
        case .ninetyDays: "90 days"
        case .allTime: "All time"
        }
    }

    var subtitle: String {
        switch self {
        case .sevenDays: "Last 7 days"
        case .thirtyDays: "Last 30 days"
        case .ninetyDays: "Last 90 days"
        case .allTime: "All time"
        }
    }

    func range(calendar: Calendar, now: Date = Date()) -> (start: Date, end: Date) {
        let start: Date
        switch self {
        case .sevenDays: start = DayMath.adding(days: -6, to: now, calendar: calendar)
        case .thirtyDays: start = DayMath.adding(days: -29, to: now, calendar: calendar)
        case .ninetyDays: start = DayMath.adding(days: -89, to: now, calendar: calendar)
        case .allTime:
            var components = DateComponents()
            components.year = 2020
            components.month = 1
            components.day = 1
            start = calendar.date(from: components) ?? now
        }
        return (DayMath.startOfDay(start, calendar: calendar), now)
    }
}

enum TrendMode: String, CaseIterable, Hashable {
    case daily, weekly, monthly
    var label: String { rawValue.capitalized }
}

// MARK: - Shared row/control helpers (used by Insights and Weekly Review)

/// A `SECTION LABEL`-style header with trailing content on the same line — for when a
/// section needs a toggle or control next to its title, where plain `SectionLabel`
/// (which always fills the row) doesn't leave room.
struct SectionHeaderRow<Trailing: View>: View {
    var text: String
    var trailing: () -> Trailing

    init(_ text: String, @ViewBuilder trailing: @escaping () -> Trailing) {
        self.text = text
        self.trailing = trailing
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(text.uppercased())
                .font(Theme.font(size: 12, weight: .semibold))
                .tracking(1)
                .foregroundStyle(Theme.onSurfaceVariant)
            Spacer()
            trailing()
        }
    }
}

/// A small rounded selector chip: sage when selected, surface-container-high otherwise.
/// Used for time-range and trend-mode pickers.
struct PillButton: View {
    var title: String
    var isSelected: Bool
    var compact = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Theme.font(.caption, weight: .medium))
                .foregroundStyle(isSelected ? Theme.onPrimary : Theme.onSurfaceVariant)
                .padding(.horizontal, compact ? Theme.grid : Theme.grid * 1.5)
                .padding(.vertical, Theme.grid * 0.75)
                .background(
                    isSelected ? Theme.primary : Theme.surfaceContainerHigh,
                    in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                )
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.2), value: isSelected)
    }
}
