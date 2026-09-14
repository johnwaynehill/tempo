import Foundation

/// A todo's recurrence rule. Stored as jsonb with **snake_case** keys
/// (`days_of_week`, `day_of_month`) because the web client writes it that way,
/// so this type keeps explicit coding keys rather than following the API's camelCase.
public struct RecurrenceRule: Codable, Hashable, Sendable {
    public var frequency: RecurrenceFrequency
    /// 0 = Sunday … 6 = Saturday (weekly only).
    public var daysOfWeek: [Int]?
    /// 1–31 (monthly only).
    public var dayOfMonth: Int?

    public init(frequency: RecurrenceFrequency, daysOfWeek: [Int]? = nil, dayOfMonth: Int? = nil) {
        self.frequency = frequency
        self.daysOfWeek = daysOfWeek
        self.dayOfMonth = dayOfMonth
    }

    private enum CodingKeys: String, CodingKey {
        case frequency
        case daysOfWeek = "days_of_week"
        case dayOfMonth = "day_of_month"
    }
}
