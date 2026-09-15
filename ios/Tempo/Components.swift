import SwiftUI
import TempoKit

/// Page title in the display face with a quiet subtitle, like the web's `<h1>` blocks.
struct PageHeader: View {
    var title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(Theme.display(.largeTitle))
                .foregroundStyle(Theme.onSurface)
                .tracking(-0.5)
            if let subtitle {
                Text(subtitle)
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .monospacedDigit()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// `TODAY'S EVENTS`-style label: 12pt semibold, tracked, uppercase, on-surface-variant.
struct SectionLabel: View {
    var text: String
    var count: Int?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.grid) {
            Text(text.uppercased())
                .font(Theme.font(size: 12, weight: .semibold))
                .tracking(1)
            if let count {
                Text("\(count)")
                    .font(Theme.font(size: 12))
                    .opacity(0.5)
            }
        }
        .foregroundStyle(Theme.onSurfaceVariant)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Centered empty state: a soft primary disc with a glyph, a display-face title, a quiet line.
struct EmptyState: View {
    var symbol: String
    var title: String
    var message: String

    var body: some View {
        VStack(spacing: Theme.grid) {
            ZStack {
                Circle()
                    .fill(Theme.primary.opacity(0.1))
                    .frame(width: 48, height: 48)
                Image(systemName: symbol)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.primary)
            }
            .padding(.bottom, Theme.grid)
            Text(title)
                .font(Theme.display(.body, weight: .semibold))
                .foregroundStyle(Theme.onSurface)
            Text(message)
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurfaceVariant)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.grid * 10)
    }
}

/// A toggleable option chip from the todo detail page: sage when selected, surface-container otherwise.
struct SelectableChip: View {
    var label: String
    var isSelected: Bool
    var square = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(Theme.font(.subheadline, weight: .medium))
                .foregroundStyle(isSelected ? Theme.onPrimary : Theme.onSurfaceVariant)
                .padding(.horizontal, square ? 0 : Theme.grid * 2)
                .frame(minWidth: 44, minHeight: 44)
                .background(
                    isSelected ? Theme.primary : Theme.surfaceContainer,
                    in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                )
                .contentShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.2), value: isSelected)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Secondary action in the detail bottom bar: `surface-container` fill, 12pt radius.
struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.font(.subheadline, weight: .medium))
            .foregroundStyle(Theme.onSurface)
            .padding(.horizontal, Theme.grid * 2)
            .frame(minHeight: 44)
            .background(Theme.surfaceContainer, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .opacity(configuration.isPressed ? 0.7 : 1)
            .animation(.easeOut(duration: 0.2), value: configuration.isPressed)
    }
}

/// Primary action in the detail bottom bar: sage fill, 12pt radius (the web's `rounded-xl`).
struct BarPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.font(.subheadline, weight: .semibold))
            .foregroundStyle(Theme.onPrimary)
            .padding(.horizontal, Theme.grid * 2)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(
                LinearGradient(colors: [Theme.primary, Theme.primaryDim], startPoint: .topLeading, endPoint: .bottomTrailing),
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.easeOut(duration: 0.2), value: configuration.isPressed)
    }
}

extension View {
    /// Makes a `List` row read as a floating card: no separator, no row fill, 12pt between cards.
    func cardRow() -> some View {
        self
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 6, leading: Theme.grid * 2, bottom: 6, trailing: Theme.grid * 2))
    }

    /// A row that holds non-list content (headers, empty states) flush with the page padding.
    func plainRow(top: CGFloat = 0, bottom: CGFloat = 0) -> some View {
        self
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: top, leading: Theme.grid * 2, bottom: bottom, trailing: Theme.grid * 2))
    }

    /// Plain list on the page surface, no system grouping chrome.
    func tempoList() -> some View {
        self
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.surface.ignoresSafeArea())
    }

    /// Pushes the todo detail when tapped without the disclosure chevron a bare
    /// `NavigationLink` adds inside a `List`.
    func navigates(to id: UUID) -> some View {
        self.background(
            NavigationLink(value: id) { EmptyView() }
                .opacity(0)
                .accessibilityHidden(true)
        )
    }
}

/// The web's defer presets: 9:00 local on the target morning.
enum DeferDates {
    static func tomorrow(from now: Date = Date(), calendar: Calendar = .current) -> Date {
        morning(of: DayMath.adding(days: 1, to: now, calendar: calendar), calendar: calendar)
    }

    static func nextWeek(from now: Date = Date(), calendar: Calendar = .current) -> Date {
        morning(of: DayMath.adding(days: 7, to: now, calendar: calendar), calendar: calendar)
    }

    private static func morning(of date: Date, calendar: Calendar) -> Date {
        calendar.date(bySettingHour: 9, minute: 0, second: 0, of: date) ?? date
    }
}
