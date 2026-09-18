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

/// One step, as sent to the server on create/update. The server assigns `id` and
/// `sortOrder` comes from array position.
public struct PlaylistItemDraft: Codable, Hashable, Sendable {
    public var title: String
    public var size: TodoSize?
    public var energyLevel: EnergyLevel?
    public var estimatedMinutes: Int?
    public var project: String?

    public init(
        title: String, size: TodoSize? = nil, energyLevel: EnergyLevel? = nil,
        estimatedMinutes: Int? = nil, project: String? = nil
    ) {
        self.title = title
        self.size = size
        self.energyLevel = energyLevel
        self.estimatedMinutes = estimatedMinutes
        self.project = project
    }

    public init(_ item: PlaylistItem) {
        title = item.title
        size = item.size
        energyLevel = item.energyLevel
        estimatedMinutes = item.estimatedMinutes
        project = item.project
    }
}

public struct PlaylistDraft: Codable, Hashable, Sendable {
    public var name: String
    public var description: String?
    public var items: [PlaylistItemDraft]?

    public init(name: String, description: String? = nil, items: [PlaylistItemDraft]? = nil) {
        self.name = name
        self.description = description
        self.items = items
    }
}

/// A full replace: the server overwrites all items with whatever is sent here, so
/// build this from the complete current+edited list, not a delta.
public struct PlaylistUpdate: Codable, Hashable, Sendable {
    public var name: String
    public var description: String?
    public var items: [PlaylistItemDraft]

    public init(name: String, description: String? = nil, items: [PlaylistItemDraft]) {
        self.name = name
        self.description = description
        self.items = items
    }
}

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
