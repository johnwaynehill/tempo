import Foundation
import Testing
@testable import TempoKit

@Suite struct PendingOpInboxTests {
    private func tempDir() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("inbox-\(UUID().uuidString)", isDirectory: true)
    }

    @Test func writesOneFilePerOpAndReadsBackInCreationOrder() throws {
        let inbox = PendingOpInbox(directory: tempDir())
        let t0 = Date(timeIntervalSince1970: 1_800_000_000)
        let later = WriteOp.createTodo(id: UUID(), createdAt: t0.addingTimeInterval(20), draft: TodoDraft(title: "Later"))
        let first = WriteOp.createTodo(id: UUID(), createdAt: t0, draft: TodoDraft(title: "First"))
        let middle = WriteOp.completeTodo(id: UUID(), createdAt: t0.addingTimeInterval(10), todoId: UUID(), actualMinutes: 3)

        try inbox.write(later)
        try inbox.write(first)
        try inbox.write(middle)

        let pending = inbox.pending()
        #expect(pending.count == 3)
        #expect(pending.map(\.op.id) == [first.id, middle.id, later.id])
        #expect(pending.allSatisfy { $0.file.pathExtension == "json" })
    }

    @Test func removeDeletesTheFile() throws {
        let inbox = PendingOpInbox(directory: tempDir())
        try inbox.write(.createTodo(draft: TodoDraft(title: "One")))
        let pending = inbox.pending()
        #expect(pending.count == 1)
        inbox.remove(pending[0].file)
        #expect(inbox.pending().isEmpty)
    }

    @Test func unreadableFilesAreDroppedNotRetried() throws {
        let dir = tempDir()
        let inbox = PendingOpInbox(directory: dir)
        try inbox.write(.createTodo(draft: TodoDraft(title: "Good")))
        try Data("not json".utf8).write(to: dir.appendingPathComponent("0-broken.json"))

        #expect(inbox.pending().count == 1)
        let names = try FileManager.default.contentsOfDirectory(atPath: dir.path)
        #expect(!names.contains("0-broken.json"))
    }

    @Test func missingDirectoryIsEmpty() {
        #expect(PendingOpInbox(directory: tempDir()).pending().isEmpty)
    }

    @Test func drainEnqueuesIntoTheStoreAndEmptiesTheInbox() async throws {
        let inbox = PendingOpInbox(directory: tempDir())
        let storeDir = tempDir()
        // enqueue never touches the network, so an unroutable client is fine here.
        let client = TempoClient(baseURL: URL(string: "http://127.0.0.1:9")!, apiKey: "tempo_test")
        let store = TempoStore(client: client, directory: storeDir)
        let a = TodoDraft(title: "From the share sheet")
        let b = TodoDraft(title: "From Shortcuts")
        try inbox.write(.createTodo(createdAt: Date(timeIntervalSince1970: 1), draft: a))
        try inbox.write(.createTodo(createdAt: Date(timeIntervalSince1970: 2), draft: b))

        let imported = await inbox.drain(into: store)

        #expect(imported == 2)
        #expect(inbox.pending().isEmpty)
        #expect(await store.pendingCount == 2)
        let titles = await store.snapshot.todos.map(\.title)
        #expect(titles.contains("From the share sheet"))
        #expect(titles.contains("From Shortcuts"))
    }
}
