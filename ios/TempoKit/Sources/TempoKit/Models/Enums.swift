import Foundation

public enum TodoStatus: String, Codable, Sendable, CaseIterable, Hashable {
    case inbox
    case todayPinned = "today_pinned"
    case backlog
    case deferred
    case done
}

public enum TodoSize: String, Codable, Sendable, CaseIterable, Hashable {
    case small, medium, large
}

public enum EnergyLevel: String, Codable, Sendable, CaseIterable, Hashable {
    case low
    case mediumLow = "medium_low"
    case medium
    case high

    /// Mirrors `ENERGY_ORDINAL` in the web client: low 0 … high 3.
    public var ordinal: Int {
        switch self {
        case .low: 0
        case .mediumLow: 1
        case .medium: 2
        case .high: 3
        }
    }
}

public enum RecurrenceFrequency: String, Codable, Sendable, CaseIterable, Hashable {
    case daily, weekly, monthly
}

public enum EventColor: String, Codable, Sendable, CaseIterable, Hashable {
    case primary, tertiary, error, neutral
}

public enum ThemePreference: String, Codable, Sendable, CaseIterable, Hashable {
    case light, dark, system
}
