import Foundation

public struct CalendarEvent: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var userId: String
    public var firestoreId: String?
    public var title: String
    public var startTime: Date
    public var endTime: Date
    public var allDay: Bool
    public var description: String?
    public var location: String?
    public var color: EventColor?
    /// `"tempo"` (native, editable) or `"google"` (mirrored, read-only).
    public var source: String
    public var externalId: String?
    public var etag: String?
    public var createdAt: Date
    public var updatedAt: Date

    public static let tempoSource = "tempo"
    public static let googleSource = "google"

    public var isReadOnly: Bool { source == Self.googleSource }

    public init(
        id: UUID = UUID(), userId: String = "", firestoreId: String? = nil, title: String,
        startTime: Date, endTime: Date, allDay: Bool = false, description: String? = nil,
        location: String? = nil, color: EventColor? = nil, source: String = CalendarEvent.tempoSource,
        externalId: String? = nil, etag: String? = nil, createdAt: Date = Date(), updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.firestoreId = firestoreId
        self.title = title
        self.startTime = startTime
        self.endTime = endTime
        self.allDay = allDay
        self.description = description
        self.location = location
        self.color = color
        self.source = source
        self.externalId = externalId
        self.etag = etag
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

extension CalendarEvent: BusyBlock {}
