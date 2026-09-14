import Foundation
import Synchronization
import Testing
@testable import TempoKit

/// Captures the outgoing request and returns a canned response.
final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    typealias Handler = @Sendable (URLRequest, Data?) throws -> (Int, Data)

    static let handler = Mutex<Handler?>(nil)
    static let lastRequest = Mutex<(URLRequest, Data?)?>(nil)

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let body = Self.readBody(request)
        Self.lastRequest.withLock { $0 = (request, body) }
        guard let handler = Self.handler.withLock({ $0 }) else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        do {
            let (status, data) = try handler(request, body)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}

    /// URLSession hands protocols a body *stream*, not `httpBody`.
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

@Suite(.serialized) struct TempoClientTests {
    let client: TempoClient

    init() {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        client = TempoClient(baseURL: URL(string: "https://example.test")!, apiKey: "tk_secret", session: URLSession(configuration: config))
    }

    func respond(_ status: Int = 200, _ json: String) {
        MockURLProtocol.handler.withLock { $0 = { _, _ in (status, Data(json.utf8)) } }
    }

    func last() throws -> (request: URLRequest, body: [String: Any]?) {
        let (req, body) = try #require(MockURLProtocol.lastRequest.withLock { $0 })
        let obj = body.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        return (req, obj)
    }

    @Test func sendsHeadersAndPath() async throws {
        respond(200, #"{"uid":"u1","email":"a@b.c","displayName":null,"photoURL":null}"#)
        let me = try await client.me()
        #expect(me.uid == "u1")
        #expect(me.displayName == nil)
        let (req, body) = try last()
        #expect(req.url?.absoluteString == "https://example.test/api/auth/me")
        #expect(req.httpMethod == "GET")
        #expect(req.value(forHTTPHeaderField: "X-API-Key") == "tk_secret")
        #expect(req.value(forHTTPHeaderField: "Content-Type") == "application/json")
        #expect(body == nil)
    }

    @Test func todosQuery() async throws {
        respond(200, "[]")
        let since = Date(timeIntervalSince1970: 1_789_252_044.667)
        let todos = try await client.todos(status: .backlog, since: since)
        #expect(todos.isEmpty)
        let (req, _) = try last()
        let items = URLComponents(url: req.url!, resolvingAgainstBaseURL: false)?.queryItems ?? []
        #expect(items.contains(URLQueryItem(name: "status", value: "backlog")))
        #expect(items.contains(URLQueryItem(name: "since", value: "2026-09-12T22:27:24.667Z")))
        respond(200, "[]")
        _ = try await client.todos()
        #expect(try last().request.url?.query == nil)
    }

    @Test func updateTodoSendsPatch() async throws {
        respond(200, JSONTests.todoJSON)
        let id = UUID(uuidString: "6F1C2A4E-3B7D-4E2A-9C1D-2F3E4A5B6C7D")!
        let todo = try await client.updateTodo(id: id, TodoPatch(title: .set("Renamed"), dueDate: .null))
        #expect(todo.id == id)
        let (req, body) = try last()
        #expect(req.httpMethod == "PUT")
        #expect(req.url?.path == "/api/todos/6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d")
        #expect(body?["title"] as? String == "Renamed")
        #expect(body?["dueDate"] is NSNull)
        #expect(body?.count == 2)
    }

    @Test func createAndCompleteTodo() async throws {
        respond(201, JSONTests.todoJSON)
        _ = try await client.createTodo(TodoDraft(title: "New", size: .small))
        var (req, body) = try last()
        #expect(req.httpMethod == "POST")
        #expect(body?["size"] as? String == "small")
        #expect(body?["description"] == nil)

        respond(200, #"{"todo":\#(JSONTests.todoJSON),"nextOccurrence":\#(JSONTests.todoJSON)}"#)
        let completed = try await client.completeTodo(id: UUID(), actualMinutes: 12)
        #expect(completed.nextOccurrence != nil)
        (req, body) = try last()
        #expect(req.url?.path.hasSuffix("/complete") == true)
        #expect(body?["actualMinutes"] as? Int == 12)

        respond(200, #"{"todo":\#(JSONTests.todoJSON),"nextOccurrence":null}"#)
        let plain = try await client.completeTodo(id: UUID())
        #expect(plain.nextOccurrence == nil)
        #expect(try last().body?.isEmpty == true)
    }

    @Test func deleteReturnsNoContent() async throws {
        respond(204, "")
        try await client.deleteTodo(id: UUID())
        #expect(try last().request.httpMethod == "DELETE")
    }

    @Test func todaySetAndHabits() async throws {
        respond(200, #"{"userId":"u","date":"2026-09-14","todoIds":[],"exists":false}"#)
        let set = try await client.todaySet(date: "2026-09-14")
        #expect(set.date == "2026-09-14")
        #expect(set.isGenerated == false)
        #expect(try last().request.url?.query == "date=2026-09-14")
        #expect(TodaySet(date: "2026-09-14").isGenerated == true)

        respond(200, #"{"userId":"u","date":"2026-09-14","todoIds":["6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d"]}"#)
        let generated = try await client.generateTodaySet(date: "2026-09-14")
        #expect(generated.todoIds.count == 1)
        var (req, body) = try last()
        #expect(req.url?.path == "/api/today-set/generate")
        #expect(body?["date"] as? String == "2026-09-14")

        respond(200, #"{"userId":"u","date":"2026-09-14","todoIds":[]}"#)
        _ = try await client.updateTodaySet(date: "2026-09-14", todoIds: [UUID(uuidString: "6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d")!])
        (req, body) = try last()
        #expect(req.httpMethod == "PUT")
        #expect((body?["todoIds"] as? [String])?.first?.lowercased() == "6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d")

        respond(200, #"{"id":"6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d","userId":"u","name":"Stretch","frequency":"daily","archived":false,"completions":{"2026-09-14":true},"createdAt":"2026-09-01T15:04:05Z","updatedAt":"2026-09-01T15:04:05Z"}"#)
        let habit = try await client.toggleHabit(id: UUID(), date: "2026-09-14", completed: true)
        #expect(habit.isCompleted(on: "2026-09-14"))
        (req, body) = try last()
        #expect(req.httpMethod == "PATCH")
        #expect(req.url?.path.hasSuffix("/completions") == true)
        #expect(body?["completed"] as? Bool == true)
    }

    @Test func startPlaylistReturnsTuple() async throws {
        respond(200, #"{"todoIds":["6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d"],"count":1}"#)
        let result = try await client.startPlaylist(id: UUID())
        #expect(result.count == 1)
        #expect(result.todoIds.count == 1)
        #expect(try last().request.httpMethod == "POST")
    }

    @Test func errorMapping() async {
        respond(401, #"{"error":"bad key"}"#)
        await #expect(throws: TempoAPIError.self) { try await client.me() }
        do { _ = try await client.me() } catch let e as TempoAPIError {
            guard case .unauthorized = e else { Issue.record("expected unauthorized, got \(e)"); return }
        } catch { Issue.record("unexpected \(error)") }

        respond(403, "{}")
        do { _ = try await client.projects() } catch let e as TempoAPIError {
            guard case .unauthorized = e else { Issue.record("expected unauthorized, got \(e)"); return }
        } catch { Issue.record("unexpected \(error)") }

        respond(500, "boom")
        do { _ = try await client.events() } catch let e as TempoAPIError {
            guard case .http(let status, let body) = e else { Issue.record("expected http, got \(e)"); return }
            #expect(status == 500)
            #expect(body == "boom")
        } catch { Issue.record("unexpected \(error)") }

        respond(200, "not json")
        do { _ = try await client.habits() } catch let e as TempoAPIError {
            guard case .decoding = e else { Issue.record("expected decoding, got \(e)"); return }
        } catch { Issue.record("unexpected \(error)") }
    }
}
