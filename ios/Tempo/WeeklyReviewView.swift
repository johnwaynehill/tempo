import SwiftUI
import TempoKit

/// One calendar week's completion stats, a 7-day mini trend, a Time sense (estimate vs.
/// actual) section, and a free-text weekly reflection that autosaves. Mirrors
/// `WeeklyReview.tsx`.
struct WeeklyReviewView: View {
    @Environment(AppModel.self) private var model
    @Environment(Session.self) private var session

    @State private var weekOffset = 0
    @State private var reflectionText = ""
    @State private var review: TempoKit.WeeklyReview?
    @State private var saveTask: Task<Void, Never>?

    private var weekStart: Date {
        let thisWeek = Insights.startOfWeek(Date(), calendar: model.calendar)
        return DayMath.adding(days: weekOffset * 7, to: thisWeek, calendar: model.calendar)
    }

    private var weekEnd: Date {
        Insights.endOfDay(DayMath.adding(days: 6, to: weekStart, calendar: model.calendar), calendar: model.calendar)
    }

    private var weekId: String { DayMath.isoDateString(weekStart, calendar: model.calendar) }
    private var isCurrentWeek: Bool { weekOffset == 0 }

    var body: some View {
        let done = model.todos.filter { $0.status == .done }
        let data = Insights.compute(done: done, range: (weekStart, weekEnd), calendar: model.calendar)
        // The range above is exactly this week, so `dailyTrend` already is the 7-day mini
        // trend — one point per day, in order. (Its "M/D" labels stand in for the web's
        // "Mon"/"Tue" abbreviations; TempoKit's `TrendPoint` has no public initializer to
        // build day-abbreviated labels from here instead.)
        let weekDays = data.dailyTrend
        let hasDueDateTodos = data.completedOnTime + data.completedLate > 0
        let calibration = data.calibration
        let pattern = Calibration.calibrationPattern(calibration)

        List {
            header.plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            if data.totalCompleted == 0 {
                EmptyState(symbol: "moon.stars", title: "A quiet week", message: "Nothing to review, and that\u{2019}s okay.")
                    .plainRow()
            } else {
                summaryCards(data, weekDays: weekDays)
                    .plainRow(bottom: Theme.grid)

                SectionLabel(text: "This week")
                    .plainRow(top: Theme.grid, bottom: Theme.grid)
                VerticalBarSeries(data: weekDays, height: 120, highlightLast: isCurrentWeek)
                    .padding(Theme.grid * 2.5)
                    .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
                    .plainRow(bottom: Theme.grid)

                if data.byProject.count > 1 {
                    SectionLabel(text: "By Project")
                        .plainRow(top: Theme.grid, bottom: Theme.grid)
                    HorizontalBarChart(data: data.byProject.map { .init(label: $0.project, value: $0.count) }, maxBars: 5)
                        .padding(Theme.grid * 2.5)
                        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
                        .plainRow(bottom: Theme.grid)
                }

                if hasDueDateTodos {
                    onTimeBar(data)
                        .plainRow(bottom: Theme.grid)
                }

                if calibration.ratio != nil {
                    SectionLabel(text: "Time sense")
                        .plainRow(top: Theme.grid, bottom: Theme.grid)
                    timeSenseCard(calibration, pattern: pattern)
                        .plainRow(bottom: Theme.grid)
                }
            }

            SectionLabel(text: "Reflection")
                .plainRow(top: Theme.grid * 2, bottom: Theme.grid)
            reflectionEditor
                .plainRow(bottom: Theme.grid)
        }
        .tempoList()
        .animation(.easeOut(duration: 0.2), value: weekOffset)
        .navigationTitle("")
        .toolbarTitleDisplayMode(.inline)
        .task { await model.loadIfNeeded() }
        .task(id: weekId) { await loadReview() }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            PageHeader(title: "Weekly Review")
            HStack(spacing: Theme.grid * 1.5) {
                Button {
                    weekOffset -= 1
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 13, weight: .semibold))
                }
                .accessibilityLabel("Previous week")

                Text(Self.weekLabel(weekStart: weekStart, calendar: model.calendar))
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)

                Button {
                    weekOffset += 1
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                }
                .disabled(isCurrentWeek)
                .opacity(isCurrentWeek ? 0.3 : 1)
                .accessibilityLabel("Next week")
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.onSurfaceVariant)
        }
    }

    // MARK: Sections

    private func summaryCards(_ data: InsightsData, weekDays: [TrendPoint]) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Theme.grid * 1.5), count: 2), spacing: Theme.grid * 1.5) {
            StatCard(
                title: "Completed",
                value: "\(data.totalCompleted)",
                subtitle: "task\(data.totalCompleted != 1 ? "s" : "")",
                accent: true
            )
            StatCard(title: "Avg / day", value: String(format: "%.1f", data.avgPerDay), subtitle: "per day")
            StatCard(
                title: "Best day",
                value: data.mostProductiveDay ?? "\u{2014}",
                subtitle: data.mostProductiveDay != nil ? "\(weekDays.map(\.value).max() ?? 0) tasks" : ""
            )
            StatCard(
                title: "Top project",
                value: (data.topProject != nil && data.topProject != "Ungrouped") ? data.topProject! : "\u{2014}",
                subtitle: data.topProject != nil ? "\(data.byProject.first?.count ?? 0) tasks" : ""
            )
        }
    }

    private func onTimeBar(_ data: InsightsData) -> some View {
        let total = data.completedOnTime + data.completedLate
        let fraction = total > 0 ? Double(data.completedOnTime) / Double(total) : 0
        return HStack(spacing: Theme.grid * 1.5) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(Theme.surfaceContainer)
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(Theme.primary)
                        .frame(width: geo.size.width * fraction)
                        .animation(.easeOut(duration: 0.5), value: fraction)
                }
            }
            .frame(height: 12)

            Text("\(data.completedOnTime) of \(total) on time")
                .font(Theme.font(.caption))
                .foregroundStyle(Theme.onSurfaceVariant)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
        }
        .padding(Theme.grid * 2.5)
        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }

    private func timeSenseCard(_ calibration: CalibrationSummary, pattern: String?) -> some View {
        VStack(alignment: .leading, spacing: Theme.grid * 2.5) {
            if let headline = Calibration.calibrationHeadline(calibration) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(headline)
                        .font(Theme.font(.subheadline))
                        .foregroundStyle(Theme.onSurface)
                    Text(
                        "\(calibration.timedCount) timed task\(calibration.timedCount != 1 ? "s" : "")"
                            + "  \u{00B7}  estimated \(TimeMath.formatMinutes(calibration.estimatedMinutes))"
                            + "  \u{00B7}  actual \(TimeMath.formatMinutes(calibration.actualMinutes))"
                    )
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .monospacedDigit()
                }
            }

            PairedBarChart(rows: calibration.bySize.map {
                .init(label: Calibration.SIZE_LABEL[$0.key] ?? $0.key, estimated: $0.estimatedMinutes, actual: $0.actualMinutes)
            })

            if calibration.byProject.count > 1 {
                PairedBarChart(rows: calibration.byProject.prefix(3).map {
                    .init(label: $0.key, estimated: $0.estimatedMinutes, actual: $0.actualMinutes)
                })
            }

            if let pattern {
                Text(pattern)
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }

            Text("Muted bar is the estimate, sage is the time you logged.")
                .font(Theme.font(size: 11))
                .foregroundStyle(Theme.onSurfaceVariant.opacity(0.6))
        }
        .padding(Theme.grid * 2.5)
        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }

    // MARK: Reflection

    private var reflectionEditor: some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            ZStack(alignment: .topLeading) {
                if reflectionText.isEmpty {
                    Text("What went well this week?")
                        .font(Theme.font(.subheadline))
                        .foregroundStyle(Theme.onSurfaceVariant.opacity(0.4))
                        .padding(.top, 8)
                        .padding(.leading, 5)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $reflectionText)
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurface)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 120)
            }
            .padding(Theme.grid * 1.5)
            .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
            .onChange(of: reflectionText) { _, newValue in
                scheduleSave(newValue)
            }

            if let updatedAt = review?.updatedAt {
                Text("Saved \(Self.savedLabel(updatedAt))")
                    .font(Theme.font(.caption2))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.5))
            }
        }
    }

    // MARK: Data

    private func loadReview() async {
        saveTask?.cancel()
        guard let client = session.client else {
            review = nil
            reflectionText = ""
            return
        }
        do {
            let all = try await client.reviews()
            let match = all.first { $0.id == weekId }
            review = match
            reflectionText = match?.reflection ?? ""
        } catch {
            // Offline or a hiccup: leave the editor blank rather than showing stale text
            // from a different week.
            review = nil
            reflectionText = ""
        }
    }

    private func scheduleSave(_ text: String) {
        guard let client = session.client else { return }
        saveTask?.cancel()
        let id = weekId
        saveTask = Task {
            try? await Task.sleep(nanoseconds: 800_000_000)
            guard !Task.isCancelled else { return }
            do {
                let saved = try await client.updateReview(id: id, reflection: text)
                if id == weekId { review = saved }
            } catch {
                // Will retry on the next keystroke or the next time this week loads.
            }
        }
    }

    // MARK: Formatting

    private static func weekLabel(weekStart: Date, calendar: Calendar) -> String {
        let end = DayMath.adding(days: 6, to: weekStart, calendar: calendar)
        let monthFormatter = DateFormatter()
        monthFormatter.calendar = calendar
        monthFormatter.locale = Locale(identifier: "en_US")
        monthFormatter.dateFormat = "MMM"

        let startMonth = monthFormatter.string(from: weekStart)
        let endMonth = monthFormatter.string(from: end)
        let startDay = calendar.component(.day, from: weekStart)
        let endDay = calendar.component(.day, from: end)
        let year = calendar.component(.year, from: end)

        if startMonth == endMonth {
            return "\(startMonth) \(startDay) - \(endDay), \(year)"
        }
        return "\(startMonth) \(startDay) - \(endMonth) \(endDay), \(year)"
    }

    private static func savedLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = "MMM d, h:mm a"
        return formatter.string(from: date)
    }
}
