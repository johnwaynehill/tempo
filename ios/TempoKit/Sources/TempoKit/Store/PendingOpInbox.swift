import Foundation

/// A drop box for `WriteOp`s from processes that must not touch the app's queue file — the
/// share extension and App Intents running outside the app. Each op is its own file, written
/// atomically, so writers never contend with each other or with the app. The app drains the
/// inbox into its `TempoStore` (optimistic apply + queue + flush) and deletes each file.
public struct PendingOpInbox: Sendable {
    public let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    /// Writes `op` as `<ms since 1970>-<op id>.json`, so a name sort is creation order.
    public func write(_ op: WriteOp) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try TempoJSON.encoder.encode(op)
        let millis = Int64((op.createdAt.timeIntervalSince1970 * 1000).rounded())
        let url = directory.appendingPathComponent("\(millis)-\(op.id.uuidString.lowercased()).json")
        try data.write(to: url, options: .atomic)
    }

    /// Pending ops in creation order with the file each came from. A file that can't be
    /// decoded would be retried forever, so it is deleted and skipped.
    public func pending() -> [(op: WriteOp, file: URL)] {
        let files = (try? FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]
        )) ?? []
        return files
            .filter { $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .compactMap { file in
                guard let data = try? Data(contentsOf: file),
                      let op = try? TempoJSON.decoder.decode(WriteOp.self, from: data) else {
                    print("[PendingOpInbox] dropping unreadable \(file.lastPathComponent)")
                    try? FileManager.default.removeItem(at: file)
                    return nil
                }
                return (op, file)
            }
    }

    public func remove(_ file: URL) {
        try? FileManager.default.removeItem(at: file)
    }

    /// Enqueues every pending op into `store` in creation order, deleting each file once the
    /// store has persisted it. Returns how many ops were imported.
    @discardableResult
    public func drain(into store: TempoStore) async -> Int {
        var imported = 0
        for (op, file) in pending() {
            _ = await store.enqueue(op)
            remove(file)
            imported += 1
        }
        return imported
    }
}
