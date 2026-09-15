import SwiftUI
import UIKit

/// The few "Quiet Rhythm" tokens the Live Activity needs. The extension can't import
/// the app target, so these duplicate the hex values in `Tempo/Theme.swift`.
enum WidgetTheme {
    static let surface = adaptive(light: 0xF9F9F8, dark: 0x1A1C1B)
    static let surfaceContainerLowest = adaptive(light: 0xFFFFFF, dark: 0x111312)
    static let surfaceContainerHigh = adaptive(light: 0xE7E8E7, dark: 0x2F3130)
    static let primary = adaptive(light: 0x4F645B, dark: 0x8FB5A4)
    static let primaryDim = adaptive(light: 0x43574F, dark: 0x7DA393)
    static let onPrimary = adaptive(light: 0xFFFFFF, dark: 0x1A2E26)
    static let onSurface = adaptive(light: 0x2F3333, dark: 0xE1E3E1)
    static let onSurfaceVariant = adaptive(light: 0x5B605F, dark: 0x9FA3A1)

    /// Seconds as "12:45" or "1:02:30" (mirrors `TimeMath.formatElapsed`).
    static func formatElapsed(_ seconds: Int) -> String {
        let s = max(0, seconds)
        let hours = s / 3600
        let minutes = (s % 3600) / 60
        let secs = s % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(widgetHex: dark) : UIColor(widgetHex: light)
        })
    }
}

private extension UIColor {
    convenience init(widgetHex hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
