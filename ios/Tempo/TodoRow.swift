import SwiftUI
import TempoKit

/// One task card on Today. Mirrors `TodoItem.tsx`: title, then a wrap of quiet chips.
struct TodoRow: View {
    let todo: Todo

    private static let dueFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d"
        return f
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            Text(todo.title)
                .font(Theme.font(size: 15))
                .foregroundStyle(Theme.onSurface)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)

            if hasMetadata {
                FlowLayout(spacing: 6) {
                    if let project = todo.project, !project.isEmpty {
                        Chip(text: project, background: Theme.primaryContainer, foreground: Theme.onSurface)
                    }
                    if let energy = todo.energyLevel {
                        Chip(text: Self.label(for: energy))
                    }
                    if let size = todo.size {
                        Chip(text: Self.label(for: size))
                    }
                    if let minutes = todo.estimatedMinutes, minutes > 0 {
                        Chip(text: TimeMath.formatMinutes(minutes), background: Theme.surfaceContainerHigh)
                    }
                    if let due = todo.dueDate {
                        Text(Self.dueFormatter.string(from: due))
                            .font(Theme.font(size: 11))
                            .foregroundStyle(Theme.onSurfaceVariant)
                            .padding(.vertical, 4)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.grid * 2)
        .background(
            Theme.surfaceContainerLowest,
            in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
        )
        .accessibilityElement(children: .combine)
    }

    private var hasMetadata: Bool {
        (todo.project?.isEmpty == false) || todo.energyLevel != nil || todo.size != nil
            || (todo.estimatedMinutes ?? 0) > 0 || todo.dueDate != nil
    }

    static func label(for energy: EnergyLevel) -> String {
        switch energy {
        case .low: "Low"
        case .mediumLow: "Med-Low"
        case .medium: "Medium"
        case .high: "High"
        }
    }

    static func label(for size: TodoSize) -> String {
        switch size {
        case .small: "Small"
        case .medium: "Medium"
        case .large: "Large"
        }
    }
}

/// Left-aligned wrapping row, like `flex-wrap`. Enough for a handful of chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        return place(in: width, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = place(in: bounds.width, subviews: subviews)
        for (index, origin) in result.origins.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
                proposal: .unspecified
            )
        }
    }

    private func place(in width: CGFloat, subviews: Subviews) -> (size: CGSize, origins: [CGPoint]) {
        var origins: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxX: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            maxX = max(maxX, x - spacing)
        }
        return (CGSize(width: maxX, height: y + rowHeight), origins)
    }
}

#Preview {
    VStack(spacing: 12) {
        TodoRow(todo: Todo(
            title: "Write the iOS README", project: "Tempo", size: .medium,
            energyLevel: .medium, dueDate: Date(), estimatedMinutes: 30
        ))
        TodoRow(todo: Todo(title: "Call the dentist"))
    }
    .padding()
    .background(Theme.surface)
}
