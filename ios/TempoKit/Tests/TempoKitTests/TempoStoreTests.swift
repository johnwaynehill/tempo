import Foundation
import Synchronization
import Testing
@testable import TempoKit

/// Like `MockURLProtocol` but keeps every request, in order, since a flush makes
/// several. Separate statics so this suite can run alongside `TempoClientTests`.
final class StoreURLProtocol: URLProtocol, @unchecked Sendable {
    struct Recorded {
        var method: String
        var path: String
        var body: [String: Any]?
        var raw: Data?
    }
    typealias Handler = @Sendable (Recorded) throws -> (Int, String)

    static let handler = Mutex<Handler?>(nil)
    static let requests = Mutex<[Recorded]>([])

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let raw = Self.readBody(request)
        let recorded = Recorded(
            method: request.httpMethod ?? "", path: request.url?.path ?? "",
            body: raw.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }, raw: raw
        )
        Self.requests.withLock { $0.append(recorded) }
        guard let handler = Self.handler.withLock({ $0 }) else {
            client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
            return
        }
        do {
            let (status, json) = try handler(recorded)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(json.utf8))
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}

    private static func readBody(_ request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let n = stream.read(&buffer, maxLength: buffer.count)
            if n <= 0 { break }
            data.append(buffer, count: n)
        }
        return data
    }
}

extension StoreURLProtocol.Recorded: @unchecked Sendable {}

@Suite(.serialized) struct TempoStoreTests {
    let client: TempoClient
    let directory: URL
    let now = LA.at(10, 0, on: LA.day(2026, 9, 14))

    static let todoA = UUID(uuidString: "6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d")!
    static let habitId = UUID(uuidString: "0d9e8f7a-6b5c-4d3e-8f1a-2b3c4d5e6f70")!
    static let habitJSON = #"{"id":"0d9e8f7a-6b5c-4d3e-8f1a-2b3c4d5e6f70","userId":"uid_123","name":"Stretch","frequency":"daily","archived":false,"completions":{"2026-09-13":true},"createdAt":"2026-09-01T15:04:05Z","updatedAt":"2026-09-01T15:04:05Z"}"#
    static let preferencesJSON = #"{"userId":"uid_123","currentEnergy":"medium","theme":"system","notificationsEnabled":false,"adaptiveTheme":false,"autoplanEnabled":true,"autoplanTimezone":"America/Los_Angeles","autoplanLastRunDate":null,"workDayStart":"09:00","workDayEnd":"17:00"}"#

    init() {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StoreURLProtocol.self]
        client = TempoClient(baseURL: URL(string: "https://example.test")!, apiKey: "tk_secret", session: URLSession(configuration: config))
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("TempoStoreTests-\(UUID().uuidString)")
        StoreURLProtocol.requests.withLock { $0 = [] }
        offline()
    }

    func makeStore() -> TempoStore {
        TempoStore(client: client, directory: directory, calendar: LA.calendar)
    }

    /// Every request fails with a transport error, as if there were no network.
    func offline() {
        StoreURLProtocol.handler.withLock { $0 = nil }
    }

    /// Routes by "METHOD /path"; anything unrouted is a 404 so a wrong path shows up.
    func serve(_ routes: [String: (Int, String)]) {
        StoreURLProtocol.handler.withLock {
            $0 = { r in routes["\(r.method) \(r.path)"] ?? (404, #"{"error":"Not found"}"#) }
        }
    }

    /// The five reads a `refresh()` makes, answering with one todo, one habit, and preferences.
    var pullRoutes: [String: (Int, String)] {
        [
            "GET /api/todos": (200, "[\(JSONTests.todoJSON)]"),
            "GET /api/events": (200, "[]"),
            "GET /api/habits": (200, "[\(Self.habitJSON)]"),
            "GET /api/projects": (200, "[]"),
            "GET /api/preferences": (200, Self.preferencesJSON),
        ]
    }

    func requests() -> [StoreURLProtocol.Recorded] {
        StoreURLProtocol.requests.withLock { $0 }
    }

    func clearRequests() {
        StoreURLProtocol.requests.withLock { $0 = [] }
    }

    func todoJSON(id: UUID, title: String) -> String {
        JSONTests.todoJSON
            .replacingOccurrences(of: Self.todoA.uuidString.lowercased(), with: id.uuidString.lowercased())
            .replacingOccurrences(of: "Write brief", with: title)
    }

    // MARK: Tests

    @Test func loadOnEmptyDirectoryIsEmpty() async {
        let store = makeStore()
        let loaded = await store.load()
        #expect(loaded == .empty)
        #expect(await store.pendingCount == 0)
        #expect(await store.snapshot.lastRefresh == nil)
    }

    @Test func enqueueOfflineIsOptimistic() async {
        serve(pullRoutes)
        let store = makeStore()
        _ = try? await store.refresh()
        offline()

        let draft = TodoDraft(title: "Buy milk", status: .todayPinned, size: .small)
        var snap = await store.enqueue(.createTodo(createdAt: now, draft: draft))
        let created = snap.todo(id: draft.id)
        #expect(created?.title == "Buy milk")
        #expect(created?.status == .todayPinned)
        #expect(created?.userId == "uid_123", "user id comes from cached preferences")
        #expect(created?.createdAt == now)
        #expect(await store.pendingCount == 1)

        snap = await store.enqueue(.updateTodo(createdAt: now, todoId: Self.todoA, patch: TodoPatch(title: .set("Renamed"), dueDate: .null)))
        #expect(snap.todo(id: Self.todoA)?.title == "Renamed")
        #expect(snap.todo(id: Self.todoA)?.dueDate == nil)
        #expect(snap.todo(id: Self.todoA)?.estimatedMinutes == 45, "untouched fields survive a patch")

        snap = await store.enqueue(.completeTodo(createdAt: now, todoId: Self.todoA, actualMinutes: 30))
        #expect(snap.todo(id: Self.todoA)?.status == .done)
        #expect(snap.todo(id: Self.todoA)?.completedAt == now)
        #expect(snap.todo(id: Self.todoA)?.actualMinutes == 30)

        snap = await store.enqueue(.toggleHabit(createdAt: now, habitId: Self.habitId, date: "2026-09-14", completed: true))
        #expect(snap.habits.first?.isCompleted(on: "2026-09-14") == true)
        snap = await store.enqueue(.toggleHabit(createdAt: now, habitId: Self.habitId, date: "2026-09-13", completed: false))
        #expect(snap.habits.first?.completions["2026-09-13"] == nil, "the server drops the key rather than writing false")

        snap = await store.enqueue(.setTodaySet(createdAt: now, date: "2026-09-14", todoIds: [draft.id]))
        #expect(snap.todaySets["2026-09-14"]?.todoIds == [draft.id])
        #expect(snap.todaySets["2026-09-14"]?.isGenerated == true)

        snap = await store.enqueue(.updatePreferences(createdAt: now, update: UserPreferencesUpdate(currentEnergy: .null, workDayEnd: "18:00")))
        #expect(snap.preferences?.currentEnergy == nil)
        #expect(snap.preferences?.workDayEnd == "18:00")
        #expect(snap.preferences?.workDayStart == "09:00")

        snap = await store.enqueue(.deleteTodo(createdAt: now, todoId: draft.id))
        #expect(snap.todo(id: draft.id) == nil)
        #expect(await store.pendingCount == 8)

        let result = await store.flush()
        #expect(result.sent == 0)
        #expect(result.remaining == 8)
        #expect(result.error != nil)
        #expect(await store.pendingCount == 8)
    }

    @Test func flushReplaysInOrderAndMergesServerRows() async throws {
        serve(pullRoutes)
        let store = makeStore()
        _ = try await store.refresh()
        offline()

        let draft = TodoDraft(title: "Buy milk")
        let next = UUID()
        await store.enqueue(.createTodo(createdAt: now, draft: draft))
        await store.enqueue(.updateTodo(createdAt: now, todoId: draft.id, patch: TodoPatch(title: .set("Buy oat milk"))))
        await store.enqueue(.completeTodo(createdAt: now, todoId: Self.todoA, actualMinutes: 30))
        await store.enqueue(.toggleHabit(createdAt: now, habitId: Self.habitId, date: "2026-09-14", completed: true))
        await store.enqueue(.setTodaySet(createdAt: now, date: "2026-09-14", todoIds: [draft.id]))
        await store.enqueue(.updatePreferences(createdAt: now, update: UserPreferencesUpdate(workDayEnd: "18:00")))
        await store.enqueue(.deleteTodo(createdAt: now, todoId: draft.id))
        clearRequests()

        let a = Self.todoA.uuidString.lowercased()
        let b = draft.id.uuidString.lowercased()
        serve([
            "POST /api/todos": (201, todoJSON(id: draft.id, title: "Buy milk")),
            "PUT /api/todos/\(b)": (200, todoJSON(id: draft.id, title: "Buy oat milk (server)")),
            "POST /api/todos/\(a)/complete": (200, #"{"todo":\#(todoJSON(id: Self.todoA, title: "Write brief")),"nextOccurrence":\#(todoJSON(id: next, title: "Write brief"))}"#),
            "PATCH /api/habits/\(Self.habitId.uuidString.lowercased())/completions": (200, Self.habitJSON.replacingOccurrences(of: #"{"2026-09-13":true}"#, with: #"{"2026-09-13":true,"2026-09-14":true}"#)),
            "PUT /api/today-set": (200, #"{"userId":"uid_123","date":"2026-09-14","todoIds":["\#(b)"]}"#),
            "PUT /api/preferences": (200, Self.preferencesJSON.replacingOccurrences(of: "17:00", with: "18:00")),
            "DELETE /api/todos/\(b)": (204, ""),
        ])

        let result = await store.flush()
        #expect(result.sent == 7)
        #expect(result.dropped == 0)
        #expect(result.remaining == 0)
        #expect(result.error == nil)
        #expect(await store.pendingCount == 0)

        let sent = requests()
        #expect(sent.map(\.method) == ["POST", "PUT", "POST", "PATCH", "PUT", "PUT", "DELETE"])
        #expect(sent.map(\.path) == [
            "/api/todos", "/api/todos/\(b)", "/api/todos/\(a)/complete",
            "/api/habits/\(Self.habitId.uuidString.lowercased())/completions", "/api/today-set", "/api/preferences",
            "/api/todos/\(b)",
        ])
        #expect((sent[0].body?["id"] as? String)?.lowercased() == b, "create sends the client-generated id")
        #expect(sent[0].body?["title"] as? String == "Buy milk")
        #expect(sent[1].body?["title"] as? String == "Buy oat milk")
        #expect(sent[1].body?.count == 1)
        #expect(sent[2].body?["actualMinutes"] as? Int == 30)
        #expect(sent[3].body?["date"] as? String == "2026-09-14")
        #expect(sent[3].body?["completed"] as? Bool == true)
        #expect((sent[4].body?["todoIds"] as? [String])?.map { $0.lowercased() } == [b])
        #expect(sent[5].body?["workDayEnd"] as? String == "18:00")
        #expect(sent[5].body?.count == 1)

        let snap = await store.snapshot
        #expect(snap.todo(id: next)?.title == "Write brief", "the next occurrence returned by /complete is inserted")
        #expect(snap.todo(id: draft.id) == nil, "deleted at the end of the queue")
        #expect(snap.preferences?.workDayEnd == "18:00")
        #expect(snap.habits.first?.isCompleted(on: "2026-09-14") == true)
        #expect(snap.todaySets["2026-09-14"]?.todoIds == [draft.id])
        #expect(snap.todos.count == 2)
    }

    @Test func serverRowReplacesOptimisticRow() async throws {
        serve(pullRoutes)
        let store = makeStore()
        _ = try await store.refresh()
        await store.enqueue(.updateTodo(createdAt: now, todoId: Self.todoA, patch: TodoPatch(title: .set("Local"))))
        serve(["PUT /api/todos/\(Self.todoA.uuidString.lowercased())": (200, todoJSON(id: Self.todoA, title: "Server"))])
        _ = await store.flush()
        #expect(await store.snapshot.todo(id: Self.todoA)?.title == "Server")
    }

    @Test func clientErrorDropsOpAndContinues() async throws {
        serve(pullRoutes)
        let store = makeStore()
        _ = try await store.refresh()
        offline()
        let gone = UUID()
        await store.enqueue(.deleteTodo(createdAt: now, todoId: gone))
        await store.enqueue(.updateTodo(createdAt: now, todoId: Self.todoA, patch: TodoPatch(progress: .set(50))))
        clearRequests()

        serve(["PUT /api/todos/\(Self.todoA.uuidString.lowercased())": (200, todoJSON(id: Self.todoA, title: "Write brief"))])
        let result = await store.flush()
        #expect(result.dropped == 1)
        #expect(result.sent == 1)
        #expect(result.remaining == 0)
        #expect(result.error == nil)
        #expect(requests().map(\.method) == ["DELETE", "PUT"])
        #expect(await store.pendingCount == 0)

        // 401 counts as a client error too.
        await store.enqueue(.updateTodo(createdAt: now, todoId: Self.todoA, patch: TodoPatch(progress: .set(60))))
        StoreURLProtocol.handler.withLock { $0 = { _ in (401, #"{"error":"bad key"}"#) } }
        let unauthorized = await store.flush()
        #expect(unauthorized.dropped == 1)
        #expect(await store.pendingCount == 0)
    }

    @Test func transportErrorStopsMidQueue() async throws {
        serve(pullRoutes)
        let store = makeStore()
        _ = try await store.refresh()
        offline()
        await store.enqueue(.updateTodo(createdAt: now, todoId: Self.todoA, patch: TodoPatch(progress: .set(10))))
        await store.enqueue(.updateTodo(createdAt: now, todoId: Self.todoA, patch: TodoPatch(progress: .set(20))))
        await store.enqueue(.updateTodo(createdAt: now, todoId: Self.todoA, patch: TodoPatch(progress: .set(30))))
        clearRequests()

        // First PUT succeeds, then the network goes away.
        let calls = Mutex(0)
        let ok = todoJSON(id: Self.todoA, title: "Write brief")
        StoreURLProtocol.handler.withLock {
            $0 = { _ in
                let n = calls.withLock { $0 += 1; return $0 }
                if n == 1 { return (200, ok) }
                throw URLError(.notConnectedToInternet)
            }
        }
        let result = await store.flush()
        #expect(result.sent == 1)
        #expect(result.dropped == 0)
        #expect(result.remaining == 2)
        #expect(result.error != nil)
        #expect(requests().count == 2, "stops at the first failure; the third op is never tried")
        #expect(await store.pendingCount == 2)
        #expect(await store.snapshot.todo(id: Self.todoA)?.progress == 30, "the still-queued ops stay applied on top of the server row")

        // A 5xx also stops rather than drops.
        StoreURLProtocol.handler.withLock { $0 = { _ in (500, "boom") } }
        let serverDown = await store.flush()
        #expect(serverDown.remaining == 2)
        #expect(serverDown.dropped == 0)
    }

    @Test func refreshReappliesQueuedOps() async throws {
        serve(pullRoutes)
        let store = makeStore()
        let first = try await store.refresh()
        #expect(first.todos.count == 1)
        #expect(first.habits.count == 1)
        #expect(first.preferences?.userId == "uid_123")
        #expect(first.lastRefresh != nil)
        #expect(Set(requests().map(\.path)) == ["/api/todos", "/api/events", "/api/habits", "/api/projects", "/api/preferences"])

        offline()
        let draft = TodoDraft(title: "Offline capture")
        await store.enqueue(.createTodo(createdAt: now, draft: draft))
        await store.enqueue(.updateTodo(createdAt: now, todoId: Self.todoA, patch: TodoPatch(title: .set("Local"))))

        // The server still knows nothing about either write.
        serve(pullRoutes)
        let again = try await store.refresh()
        #expect(again.todo(id: Self.todoA)?.title == "Local")
        #expect(again.todo(id: draft.id)?.title == "Offline capture")
        #expect(again.todos.count == 2)
        #expect(await store.pendingCount == 2)
    }

    @Test func refreshTodayGeneratesMissingSet() async throws {
        var routes = pullRoutes
        routes["GET /api/today-set"] = (200, #"{"userId":"uid_123","date":"2026-09-14","todoIds":[],"exists":false}"#)
        routes["POST /api/today-set/generate"] = (200, #"{"userId":"uid_123","date":"2026-09-14","todoIds":["\#(Self.todoA.uuidString.lowercased())"]}"#)
        serve(routes)
        let store = makeStore()
        let snap = try await store.refreshToday(now: now)
        #expect(snap.todaySets["2026-09-14"]?.todoIds == [Self.todoA])
        #expect(requests().contains { $0.path == "/api/today-set/generate" && $0.body?["date"] as? String == "2026-09-14" })

        // Already generated: no generate call.
        routes["GET /api/today-set"] = (200, #"{"userId":"uid_123","date":"2026-09-14","todoIds":[]}"#)
        serve(routes)
        clearRequests()
        _ = try await store.refresh(todayDate: "2026-09-14")
        #expect(!requests().contains { $0.path == "/api/today-set/generate" })

        // A queued set for the day wins over the server's and suppresses generation.
        routes["GET /api/today-set"] = (200, #"{"userId":"uid_123","date":"2026-09-14","todoIds":[],"exists":false}"#)
        serve(routes)
        clearRequests()
        let mine = UUID()
        await store.enqueue(.setTodaySet(createdAt: now, date: "2026-09-14", todoIds: [mine]))
        let withQueue = try await store.refresh(todayDate: "2026-09-14")
        #expect(withQueue.todaySets["2026-09-14"]?.todoIds == [mine])
        #expect(!requests().contains { $0.path == "/api/today-set/generate" })
    }

    @Test func refreshFailurePreservesCache() async throws {
        serve(pullRoutes)
        let store = makeStore()
        _ = try await store.refresh()
        offline()
        await #expect(throws: TempoAPIError.self) { try await store.refresh() }
        #expect(await store.snapshot.todos.count == 1)
    }

    @Test func persistenceSurvivesNewStore() async throws {
        serve(pullRoutes)
        let store = makeStore()
        _ = try await store.refresh()
        offline()
        let draft = TodoDraft(title: "Persisted")
        await store.enqueue(.createTodo(createdAt: now, draft: draft))
        await store.enqueue(.updateTodo(createdAt: now, todoId: Self.todoA, patch: TodoPatch(title: .set("Local"), dueDate: .null)))
        let before = await store.snapshot
        let queuedIds = await store.pendingOps.map(\.id)
        #expect(FileManager.default.fileExists(atPath: directory.appendingPathComponent("cache.json").path))
        #expect(FileManager.default.fileExists(atPath: directory.appendingPathComponent("queue.json").path))

        let reopened = makeStore()
        let loaded = await reopened.load()
        #expect(loaded == before)
        #expect(await reopened.pendingCount == 2)
        #expect(await reopened.pendingOps.map(\.id) == queuedIds)

        // The reopened store can drain the queue it inherited, with the patch's explicit null intact.
        clearRequests()
        serve([
            "POST /api/todos": (201, todoJSON(id: draft.id, title: "Persisted")),
            "PUT /api/todos/\(Self.todoA.uuidString.lowercased())": (200, todoJSON(id: Self.todoA, title: "Local")),
        ])
        let result = await reopened.flush()
        #expect(result.sent == 2)
        #expect(requests()[1].body?["dueDate"] is NSNull)
        #expect(await reopened.pendingCount == 0)

        // Without an explicit load(), the first access still reads from disk.
        let third = makeStore()
        #expect(await third.pendingCount == 0)
        #expect(await third.snapshot.todo(id: draft.id)?.title == "Persisted")
    }

    @Test func signOutWipes() async throws {
        serve(pullRoutes)
        let store = makeStore()
        _ = try await store.refresh()
        await store.enqueue(.deleteTodo(createdAt: now, todoId: Self.todoA))
        await store.signOut()
        #expect(await store.snapshot == .empty)
        #expect(await store.pendingCount == 0)
        #expect(!FileManager.default.fileExists(atPath: directory.appendingPathComponent("cache.json").path))
        #expect(!FileManager.default.fileExists(atPath: directory.appendingPathComponent("queue.json").path))
        #expect(await makeStore().load() == .empty)
    }

    @Test func writeOpJSONRoundTrip() throws {
        let ops: [WriteOp] = [
            .createTodo(createdAt: now, draft: TodoDraft(title: "A", dueDate: now)),
            .updateTodo(createdAt: now, todoId: Self.todoA, patch: TodoPatch(description: .null, status: .set(.backlog))),
            .completeTodo(createdAt: now, todoId: Self.todoA, actualMinutes: nil),
            .deleteTodo(createdAt: now, todoId: Self.todoA),
            .toggleHabit(createdAt: now, habitId: Self.habitId, date: "2026-09-14", completed: false),
            .setTodaySet(createdAt: now, date: "2026-09-14", todoIds: [Self.todoA]),
            .updatePreferences(createdAt: now, update: UserPreferencesUpdate(currentEnergy: .set(.high), theme: .dark)),
        ]
        let data = try TempoJSON.encoder.encode(ops)
        let back = try TempoJSON.decoder.decode([WriteOp].self, from: data)
        #expect(back == ops)
        #expect(back.map(\.createdAt) == Array(repeating: now, count: 7))
        #expect(back[1].todoId == Self.todoA)
        #expect(back[0].todoId == ops[0].todoId)
        #expect(back[4].todoId == nil)
        if case .updateTodo(_, _, _, let patch) = back[1] {
            #expect(patch.description == .null)
            #expect(patch.title == nil)
        } else {
            Issue.record("expected updateTodo")
        }
    }
}
