import SwiftUI

/// Small metadata pill: 4pt vertical / 8pt horizontal padding, 8pt radius, no border.
struct Chip: View {
    var text: String
    var background: Color = Theme.secondaryContainer
    var foreground: Color = Theme.onSurfaceVariant

    var body: some View {
        Text(text)
            .font(Theme.font(size: 11, weight: .medium))
            .foregroundStyle(foreground)
            .padding(.vertical, 4)
            .padding(.horizontal, 8)
            .background(background, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .lineLimit(1)
    }
}

#Preview {
    HStack {
        Chip(text: "Tempo", background: Theme.primaryContainer, foreground: Theme.onSurface)
        Chip(text: "Medium")
        Chip(text: "30m", background: Theme.surfaceContainerHigh)
    }
    .padding()
    .background(Theme.surface)
}
