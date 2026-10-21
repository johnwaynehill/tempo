import Foundation

public struct UserPreferences: Codable, Identifiable, Hashable, Sendable {
    public var userId: String
    public var currentEnergy: EnergyLevel?
    public var theme: ThemePreference
    public var notificationsEnabled: Bool
    public var adaptiveTheme: Bool
    public var autoplanEnabled: Bool
    /// IANA zone used to compute "today" for the morning auto-plan.
    public var autoplanTimezone: String
    /// Server-managed; ignored on write.
    public var autoplanLastRunDate: String?
    /// `"HH:MM"` local wall-clock.
    public var workDayStart: String
    public var workDayEnd: String
    /// One push a day at `habitReminderTime` (`"HH:MM"` in `autoplanTimezone`) while habits are open.
    public var habitReminderEnabled: Bool
    public var habitReminderTime: String

    public var id: String { userId }

    public init(
        userId: String = "", currentEnergy: EnergyLevel? = nil, theme: ThemePreference = .system,
        notificationsEnabled: Bool = false, adaptiveTheme: Bool = false, autoplanEnabled: Bool = false,
        autoplanTimezone: String = "America/Los_Angeles", autoplanLastRunDate: String? = nil,
        workDayStart: String = "09:00", workDayEnd: String = "17:00",
        habitReminderEnabled: Bool = false, habitReminderTime: String = "20:00"
    ) {
        self.userId = userId
        self.currentEnergy = currentEnergy
        self.theme = theme
        self.notificationsEnabled = notificationsEnabled
        self.adaptiveTheme = adaptiveTheme
        self.autoplanEnabled = autoplanEnabled
        self.autoplanTimezone = autoplanTimezone
        self.autoplanLastRunDate = autoplanLastRunDate
        self.workDayStart = workDayStart
        self.workDayEnd = workDayEnd
        self.habitReminderEnabled = habitReminderEnabled
        self.habitReminderTime = habitReminderTime
    }

    /// Fields added after launch decode with their defaults, so an older server or a cache
    /// written by an older build still loads.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        userId = try c.decode(String.self, forKey: .userId)
        currentEnergy = try c.decodeIfPresent(EnergyLevel.self, forKey: .currentEnergy)
        theme = try c.decode(ThemePreference.self, forKey: .theme)
        notificationsEnabled = try c.decode(Bool.self, forKey: .notificationsEnabled)
        adaptiveTheme = try c.decode(Bool.self, forKey: .adaptiveTheme)
        autoplanEnabled = try c.decode(Bool.self, forKey: .autoplanEnabled)
        autoplanTimezone = try c.decode(String.self, forKey: .autoplanTimezone)
        autoplanLastRunDate = try c.decodeIfPresent(String.self, forKey: .autoplanLastRunDate)
        workDayStart = try c.decodeIfPresent(String.self, forKey: .workDayStart) ?? "09:00"
        workDayEnd = try c.decodeIfPresent(String.self, forKey: .workDayEnd) ?? "17:00"
        habitReminderEnabled = try c.decodeIfPresent(Bool.self, forKey: .habitReminderEnabled) ?? false
        habitReminderTime = try c.decodeIfPresent(String.self, forKey: .habitReminderTime) ?? "20:00"
    }
}

/// Body for `PUT /api/preferences`. Only non-nil fields are sent; `currentEnergy` uses
/// `Patch` so it can be cleared. Decodable so it can sit in the write queue.
public struct UserPreferencesUpdate: Codable, Hashable, Sendable {
    public var currentEnergy: Patch<EnergyLevel>?
    public var theme: ThemePreference?
    public var notificationsEnabled: Bool?
    public var adaptiveTheme: Bool?
    public var autoplanEnabled: Bool?
    public var autoplanTimezone: String?
    public var workDayStart: String?
    public var workDayEnd: String?
    public var habitReminderEnabled: Bool?
    public var habitReminderTime: String?

    public init(
        currentEnergy: Patch<EnergyLevel>? = nil, theme: ThemePreference? = nil,
        notificationsEnabled: Bool? = nil, adaptiveTheme: Bool? = nil, autoplanEnabled: Bool? = nil,
        autoplanTimezone: String? = nil, workDayStart: String? = nil, workDayEnd: String? = nil,
        habitReminderEnabled: Bool? = nil, habitReminderTime: String? = nil
    ) {
        self.currentEnergy = currentEnergy
        self.theme = theme
        self.notificationsEnabled = notificationsEnabled
        self.adaptiveTheme = adaptiveTheme
        self.autoplanEnabled = autoplanEnabled
        self.autoplanTimezone = autoplanTimezone
        self.workDayStart = workDayStart
        self.workDayEnd = workDayEnd
        self.habitReminderEnabled = habitReminderEnabled
        self.habitReminderTime = habitReminderTime
    }

    private enum CodingKeys: String, CodingKey {
        case currentEnergy, theme, notificationsEnabled, adaptiveTheme, autoplanEnabled,
             autoplanTimezone, workDayStart, workDayEnd, habitReminderEnabled, habitReminderTime
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        currentEnergy = try c.decodePatch(forKey: .currentEnergy)
        theme = try c.decodeIfPresent(ThemePreference.self, forKey: .theme)
        notificationsEnabled = try c.decodeIfPresent(Bool.self, forKey: .notificationsEnabled)
        adaptiveTheme = try c.decodeIfPresent(Bool.self, forKey: .adaptiveTheme)
        autoplanEnabled = try c.decodeIfPresent(Bool.self, forKey: .autoplanEnabled)
        autoplanTimezone = try c.decodeIfPresent(String.self, forKey: .autoplanTimezone)
        workDayStart = try c.decodeIfPresent(String.self, forKey: .workDayStart)
        workDayEnd = try c.decodeIfPresent(String.self, forKey: .workDayEnd)
        habitReminderEnabled = try c.decodeIfPresent(Bool.self, forKey: .habitReminderEnabled)
        habitReminderTime = try c.decodeIfPresent(String.self, forKey: .habitReminderTime)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodePatch(currentEnergy, forKey: .currentEnergy)
        try c.encodeIfPresent(theme, forKey: .theme)
        try c.encodeIfPresent(notificationsEnabled, forKey: .notificationsEnabled)
        try c.encodeIfPresent(adaptiveTheme, forKey: .adaptiveTheme)
        try c.encodeIfPresent(autoplanEnabled, forKey: .autoplanEnabled)
        try c.encodeIfPresent(autoplanTimezone, forKey: .autoplanTimezone)
        try c.encodeIfPresent(workDayStart, forKey: .workDayStart)
        try c.encodeIfPresent(workDayEnd, forKey: .workDayEnd)
        try c.encodeIfPresent(habitReminderEnabled, forKey: .habitReminderEnabled)
        try c.encodeIfPresent(habitReminderTime, forKey: .habitReminderTime)
    }
}

extension UserPreferences {
    /// The preferences after `update`, the way the server would merge it. Used for
    /// optimistic updates; `autoplanLastRunDate` is server-owned and untouched.
    public func applying(_ update: UserPreferencesUpdate) -> UserPreferences {
        var p = self
        if let e = update.currentEnergy {
            switch e {
            case .set(let v): p.currentEnergy = v
            case .null: p.currentEnergy = nil
            }
        }
        if let v = update.theme { p.theme = v }
        if let v = update.notificationsEnabled { p.notificationsEnabled = v }
        if let v = update.adaptiveTheme { p.adaptiveTheme = v }
        if let v = update.autoplanEnabled { p.autoplanEnabled = v }
        if let v = update.autoplanTimezone { p.autoplanTimezone = v }
        if let v = update.workDayStart { p.workDayStart = v }
        if let v = update.workDayEnd { p.workDayEnd = v }
        if let v = update.habitReminderEnabled { p.habitReminderEnabled = v }
        if let v = update.habitReminderTime { p.habitReminderTime = v }
        return p
    }
}
