import SwiftUI
import UIKit

/// "Quiet Rhythm" design tokens. Hierarchy comes from the surface ramp, never from borders.
enum Theme {
    // MARK: Surfaces
    static let surface = adaptive(light: 0xF9F9F8, dark: 0x1A1C1B)
    static let surfaceContainerLowest = adaptive(light: 0xFFFFFF, dark: 0x111312)
    static let surfaceContainerLow = adaptive(light: 0xF3F4F3, dark: 0x1F2120)
    static let surfaceContainer = adaptive(light: 0xEDEEED, dark: 0x252726)
    static let surfaceContainerHigh = adaptive(light: 0xE7E8E7, dark: 0x2F3130)
    static let surfaceContainerHighest = adaptive(light: 0xE1E2E1, dark: 0x3A3C3B)

    // MARK: Primary
    static let primary = adaptive(light: 0x4F645B, dark: 0x8FB5A4)
    static let primaryDim = adaptive(light: 0x43574F, dark: 0x7DA393)
    static let onPrimary = adaptive(light: 0xFFFFFF, dark: 0x1A2E26)
    static let primaryContainer = adaptive(light: 0xD1DDD6, dark: 0x3A544A)

    // MARK: Content
    static let onSurface = adaptive(light: 0x2F3333, dark: 0xE1E3E1)
    static let onSurfaceVariant = adaptive(light: 0x5B605F, dark: 0x9FA3A1)
    static let secondaryContainer = adaptive(light: 0xDCE5DF, dark: 0x3A4A40)
    static let outlineVariant = adaptive(light: 0xAFB3B2, dark: 0x4A4E4D)
    static let error = adaptive(light: 0xA83836, dark: 0xE5726F)

    // MARK: Shape & spacing
    static let cardRadius: CGFloat = 16
    static let grid: CGFloat = 8

    // MARK: Type
    /// Single indirection for fonts so Manrope/Inter can be bundled later without touching views.
    static func font(_ style: Font.TextStyle, weight: Font.Weight = .regular, design: Font.Design = .default) -> Font {
        Font.system(style, design: design).weight(weight)
    }

    static func font(size: CGFloat, weight: Font.Weight = .regular, design: Font.Design = .default) -> Font {
        Font.system(size: size, weight: weight, design: design)
    }

    /// Headline face ("Manrope" on the web). System font until fonts are bundled.
    static func display(_ style: Font.TextStyle, weight: Font.Weight = .bold) -> Font {
        font(style, weight: weight, design: .rounded)
    }

    // MARK: Helpers
    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
