import Foundation

public struct PlaylistItem: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var playlistId: UUID
    public var title: String
    public var sortOrder: Int
    public var size: TodoSize?
    public var energyLevel: EnergyLevel?
    public var estimatedMinutes: Int?
    public var project: String?

    public init(
        id: UUID = UUID(), playlistId: UUID, title: String, sortOrder: Int = 0, size: TodoSize? = nil,
        energyLevel: EnergyLevel? = nil, estimatedMinutes: Int? = nil, project: String? = nil
    ) {
        self.id = id
        self.playlistId = playlistId
        self.title = title
        self.sortOrder = sortOrder
        self.size = size
        self.energyLevel = energyLevel
        self.estimatedMinutes = estimatedMinutes
        self.project = project
    }
}

extension PlaylistItem: Estimable {}

public struct Playlist: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var userId: String
    public var name: String
    public var description: String?
    public var items: [PlaylistItem]
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: UUID = UUID(), userId: String = "", name: String, description: String? = nil,
        items: [PlaylistItem] = [], createdAt: Date = Date(), updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.description = description
        self.items = items
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
