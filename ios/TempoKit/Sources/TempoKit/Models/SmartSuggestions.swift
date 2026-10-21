import Foundation

/// `POST /api/smart-capture`: fields Claude suggests for a new todo from its title alone
/// (the web drawer's smart capture). Every field is optional; the server drops anything invalid,
/// and `project` is always one of the user's existing projects.
public struct SmartSuggestions: Codable, Hashable, Sendable {
    public var energyLevel: EnergyLevel?
    public var size: TodoSize?
    public var project: String?
    public var impact: Int?
    public var estimatedMinutes: Int?
    /// `yyyy-MM-dd`, in the user's local calendar.
    public var dueDate: String?

    public init(
        energyLevel: EnergyLevel? = nil, size: TodoSize? = nil, project: String? = nil,
        impact: Int? = nil, estimatedMinutes: Int? = nil, dueDate: String? = nil
    ) {
        self.energyLevel = energyLevel
        self.size = size
        self.project = project
        self.impact = impact
        self.estimatedMinutes = estimatedMinutes
        self.dueDate = dueDate
    }

    /// `dueDate` as local midnight, or nil when it doesn't parse.
    public func dueDate(calendar: Calendar) -> Date? {
        guard let dueDate else { return nil }
        let parts = dueDate.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    /// Only the suggestions for fields that aren't set yet, so a choice you made by hand
    /// is never overwritten (`SmartCaptureSuggestions.tsx`'s `setFields`).
    public func unsetOnly(
        energyLevel: EnergyLevel?, size: TodoSize?, project: String?,
        impact: Int?, estimatedMinutes: Int?, dueDate: Date?
    ) -> SmartSuggestions {
        SmartSuggestions(
            energyLevel: energyLevel == nil ? self.energyLevel : nil,
            size: size == nil ? self.size : nil,
            project: project == nil ? self.project : nil,
            impact: impact == nil ? self.impact : nil,
            estimatedMinutes: estimatedMinutes == nil ? self.estimatedMinutes : nil,
            dueDate: dueDate == nil ? self.dueDate : nil
        )
    }

    public var isEmpty: Bool {
        energyLevel == nil && size == nil && project == nil && impact == nil && estimatedMinutes == nil && dueDate == nil
    }
}
