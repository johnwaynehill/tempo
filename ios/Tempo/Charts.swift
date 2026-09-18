import SwiftUI
import TempoKit

/// Small, hand-rolled chart components shared by Insights and Weekly Review — ports of
/// `src/components/charts/*.tsx`. No charting library is available, so everything here
/// is plain SwiftUI `Shape`/`Path`/`GeometryReader`, kept deliberately simple.

// MARK: - StatCard

/// A small stat tile: title, big value, optional subtitle. Mirrors `StatCard.tsx`.
struct StatCard: View {
    var title: String
    var value: String
    var subtitle: String?
    var accent = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(Theme.font(.caption, weight: .medium))
                .foregroundStyle(Theme.onSurfaceVariant)
            Text(value)
                .font(Theme.display(.title2))
                .foregroundStyle(accent ? Theme.primary : Theme.onSurface)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(Theme.font(.caption2))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.grid * 2.5)
        .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }
}

// MARK: - HorizontalBarChart

/// Label/value pairs as horizontal bars — e.g. the by-project breakdown. Mirrors
/// `HorizontalBarChart.tsx`. Optionally capped to the first `maxBars` items.
struct HorizontalBarChart: View {
    struct Item: Identifiable, Hashable {
        var label: String
        var value: Int
        var id: String { label }
    }

    var data: [Item]
    var maxBars: Int = 8

    var body: some View {
        let visible = Array(data.prefix(maxBars))
        let maxValue = max(visible.map(\.value).max() ?? 1, 1)

        VStack(spacing: Theme.grid * 1.25) {
            ForEach(visible) { item in
                HStack(spacing: Theme.grid * 1.5) {
                    Text(item.label)
                        .font(Theme.font(.caption))
                        .foregroundStyle(Theme.onSurfaceVariant)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .frame(width: 90, alignment: .trailing)

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Theme.surfaceContainer)
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Theme.primary.opacity(0.7))
                                .frame(width: geo.size.width * CGFloat(item.value) / CGFloat(maxValue))
                        }
                    }
                    .frame(height: 22)

                    Text("\(item.value)")
                        .font(Theme.font(.caption))
                        .foregroundStyle(Theme.onSurfaceVariant)
                        .monospacedDigit()
                        .frame(width: 28, alignment: .trailing)
                }
            }
        }
        .animation(.easeOut(duration: 0.4), value: visible)
    }
}

// MARK: - VerticalBarSeries

/// A trend as vertical bars — the `TrendPoint` renderer used by Activity and the 7-day
/// mini trend. Mirrors `VerticalBarSeries.tsx`. `labelInterval` thins out x-axis labels
/// when there are many points; `highlightLast` draws the final bar in full-strength primary.
struct VerticalBarSeries: View {
    var data: [TrendPoint]
    var height: CGFloat = 140
    var labelInterval: Int?
    var highlightLast = false

    private var interval: Int {
        labelInterval ?? (data.count > 14 ? Int((Double(data.count) / 7).rounded(.up)) : 1)
    }

    var body: some View {
        if data.isEmpty {
            HStack {
                Spacer()
                Text("No activity in this period")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
                Spacer()
            }
            .frame(height: min(height, 80))
        } else {
            let maxValue = max(data.map(\.value).max() ?? 1, 1)
            let columnWidth: CGFloat = 24
            let content = HStack(alignment: .bottom, spacing: 3) {
                ForEach(Array(data.enumerated()), id: \.offset) { index, item in
                    column(item: item, index: index, maxValue: maxValue)
                        .frame(width: data.count > 10 ? columnWidth : nil, height: height)
                        .frame(maxWidth: data.count > 10 ? nil : .infinity)
                }
            }

            if data.count > 10 {
                ScrollView(.horizontal, showsIndicators: false) {
                    content
                }
            } else {
                content
            }
        }
    }

    @ViewBuilder
    private func column(item: TrendPoint, index: Int, maxValue: Int) -> some View {
        let barHeight: CGFloat = item.value > 0
            ? max(4, CGFloat(item.value) / CGFloat(maxValue) * (height - 28))
            : 0
        let isLast = highlightLast && index == data.count - 1

        VStack(spacing: 2) {
            Spacer(minLength: 0)
            if item.value > 0 {
                Text("\(item.value)")
                    .font(Theme.font(size: 10))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .monospacedDigit()
            }
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(isLast ? Theme.primary : Theme.primary.opacity(0.6))
                .frame(width: 18, height: barHeight)
            if index % max(1, interval) == 0 {
                Text(item.label)
                    .font(Theme.font(size: 9))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.6))
                    .lineLimit(1)
            }
        }
        .animation(.easeOut(duration: 0.4), value: barHeight)
    }
}

// MARK: - PairedBarChart

/// Rows of label + two stacked bars (estimated over actual), in minutes — the Time
/// sense section. Mirrors `PairedBarChart.tsx`: muted bar is the estimate, primary/sage
/// is the time actually logged.
struct PairedBarChart: View {
    struct Row: Identifiable, Hashable {
        var label: String
        var estimated: Int
        var actual: Int
        var id: String { label }
    }

    var rows: [Row]

    var body: some View {
        if !rows.isEmpty {
            let maxValue = max(rows.flatMap { [$0.estimated, $0.actual] }.max() ?? 1, 1)

            VStack(spacing: Theme.grid * 1.5) {
                ForEach(rows) { row in
                    HStack(spacing: Theme.grid * 1.5) {
                        Text(row.label)
                            .font(Theme.font(.caption))
                            .foregroundStyle(Theme.onSurfaceVariant)
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .frame(width: 90, alignment: .trailing)

                        VStack(spacing: 4) {
                            bar(value: row.estimated, max: maxValue, color: Theme.surfaceContainerHighest)
                            bar(value: row.actual, max: maxValue, color: Theme.primary.opacity(0.7))
                        }

                        Text("\(TimeMath.formatMinutes(row.estimated)) \u{2192} \(TimeMath.formatMinutes(row.actual))")
                            .font(Theme.font(.caption))
                            .foregroundStyle(Theme.onSurfaceVariant)
                            .monospacedDigit()
                            .lineLimit(1)
                            .frame(width: 108, alignment: .trailing)
                    }
                }
            }
        }
    }

    private func bar(value: Int, max maxValue: Int, color: Color) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(Theme.surfaceContainer)
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(color)
                    .frame(width: geo.size.width * CGFloat(value) / CGFloat(maxValue))
            }
        }
        .frame(height: 8)
    }
}

// MARK: - ProgressRing

/// A single percentage as a ring — on-time %. Mirrors `ProgressRing.tsx`.
struct ProgressRing: View {
    /// Value 0-100.
    var value: Double
    var size: CGFloat = 80
    var strokeWidth: CGFloat = 8
    var label: String?

    var body: some View {
        VStack(spacing: Theme.grid) {
            ZStack {
                Circle()
                    .stroke(Theme.surfaceContainerHigh, lineWidth: strokeWidth)
                Circle()
                    .trim(from: 0, to: CGFloat(min(max(value, 0), 100)) / 100)
                    .stroke(Theme.primary, style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.7), value: value)
            }
            .frame(width: size, height: size)
            .accessibilityElement()
            .accessibilityLabel("\(Int(value.rounded()))% complete")

            if let label {
                Text(label)
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
        }
    }
}
