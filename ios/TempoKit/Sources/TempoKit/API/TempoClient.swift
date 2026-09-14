import Foundation

/// Client for the Tempo REST API, authenticated with an API key.
///
/// Every request carries `X-API-Key` and `Content-Type: application/json`. Bodies are
/// encoded with `TempoJSON.encoder`, so dates always go out as full ISO-8601 strings.
///
/// Server quirk worth knowing: the API rewrites any top-level body string matching
/// `^\d{4}-\d{2}-\d{2}(T|$)` into a Date before it reaches the route. Full ISO-8601
/// timestamps are what it expects for date columns; never put a bare `yyyy-MM-dd`
/// (or a string starting with one) in a text field such as `title`.
public actor TempoClient {
    public static let productionURL = URL(string: "https://tempo-api-production.up.railway.app")!

    public let baseURL: URL
    private let apiKey: String
    private let session: URLSession

    public init(baseURL: URL = TempoClient.productionURL, apiKey: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.session = session
    }

    // MARK: Auth

    public func me() async throws -> AuthMe {
        try await request("GET", "/api/auth/me")
    }

    // MARK: Todos

    public func todos(status: TodoStatus? = nil, since: Date? = nil) async throws -> [Todo] {
        var query: [URLQueryItem] = []
        if let status { query.append(URLQueryItem(name: "status", value: status.rawValue)) }
        if let since { query.append(URLQueryItem(name: "since", value: TempoJSON.formatDate(since))) }
        return try await request("GET", "/api/todos", query: query)
    }

    public func todo(id: UUID) async throws -> Todo {
        try await request("GET", "/api/todos/\(id.uuidString.lowercased())")
    }

    public func createTodo(_ draft: TodoDraft) async throws -> Todo {
        try await request("POST", "/api/todos", body: draft)
    }

    public func updateTodo(id: UUID, _ patch: TodoPatch) async throws -> Todo {
        try await request("PUT", "/api/todos/\(id.uuidString.lowercased())", body: patch)
    }

    public func deleteTodo(id: UUID) async throws {
        try await requestVoid("DELETE", "/api/todos/\(id.uuidString.lowercased())")
    }

    /// `POST /api/todos/:id/complete` — marks the todo done, optionally recording timed
    /// minutes. The server creates the next occurrence of a recurring todo and returns it.
    public func completeTodo(id: UUID, actualMinutes: Int? = nil) async throws -> CompletionResult {
        struct Body: Encodable { var actualMinutes: Int? }
        return try await request("POST", "/api/todos/\(id.uuidString.lowercased())/complete", body: Body(actualMinutes: actualMinutes))
    }

    // MARK: Today set

    /// `date` is `yyyy-MM-dd`.
    public func todaySet(date: String) async throws -> TodaySet {
        try await request("GET", "/api/today-set", query: [URLQueryItem(name: "date", value: date)])
    }

    /// Ask the server to build the day's suggestion set with its own scoring.
    public func generateTodaySet(date: String) async throws -> TodaySet {
        struct Body: Encodable { var date: String }
        return try await request("POST", "/api/today-set/generate", body: Body(date: date))
    }

    public func updateTodaySet(date: String, todoIds: [UUID]) async throws -> TodaySet {
        struct Body: Encodable { var date: String; var todoIds: [UUID] }
        return try await request("PUT", "/api/today-set", body: Body(date: date, todoIds: todoIds))
    }

    // MARK: Preferences

    public func preferences() async throws -> UserPreferences {
        try await request("GET", "/api/preferences")
    }

    public func updatePreferences(_ update: UserPreferencesUpdate) async throws -> UserPreferences {
        try await request("PUT", "/api/preferences", body: update)
    }

    // MARK: Events, habits, projects, playlists

    public func events() async throws -> [CalendarEvent] {
        try await request("GET", "/api/events")
    }

    public func habits() async throws -> [Habit] {
        try await request("GET", "/api/habits")
    }

    /// `date` is `yyyy-MM-dd`; the server keys `completions` by that string.
    public func toggleHabit(id: UUID, date: String, completed: Bool) async throws -> Habit {
        struct Body: Encodable { var date: String; var completed: Bool }
        return try await request("PATCH", "/api/habits/\(id.uuidString.lowercased())/completions", body: Body(date: date, completed: completed))
    }

    public func projects() async throws -> [Project] {
        try await request("GET", "/api/projects")
    }

    public func playlists() async throws -> [Playlist] {
        try await request("GET", "/api/playlists")
    }

    /// Creates `today_pinned` todos from the playlist's items.
    public func startPlaylist(id: UUID) async throws -> (todoIds: [UUID], count: Int) {
        struct Response: Decodable { var todoIds: [UUID]; var count: Int }
        let r: Response = try await request("POST", "/api/playlists/\(id.uuidString.lowercased())/start")
        return (r.todoIds, r.count)
    }

    // MARK: AI usage

    public func aiUsage() async throws -> AiUsageSummary {
        try await request("GET", "/api/ai-usage")
    }

    // MARK: Plumbing

    private func makeRequest(_ method: String, _ path: String, query: [URLQueryItem], body: (any Encodable)?) throws -> URLRequest {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        let basePath = components.path.hasSuffix("/") ? String(components.path.dropLast()) : components.path
        components.path = basePath + path
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { throw TempoAPIError.invalidResponse }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            do {
                req.httpBody = try TempoJSON.encoder.encode(AnyEncodable(body))
            } catch {
                throw TempoAPIError.decoding(error)
            }
        }
        return req
    }

    private func send(_ req: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw TempoAPIError.transport(error)
        }
        guard let http = response as? HTTPURLResponse else { throw TempoAPIError.invalidResponse }
        switch http.statusCode {
        case 200..<300:
            return (data, http)
        case 401, 403:
            throw TempoAPIError.unauthorized
        default:
            throw TempoAPIError.http(status: http.statusCode, body: String(decoding: data, as: UTF8.self))
        }
    }

    private func request<T: Decodable>(
        _ method: String, _ path: String, query: [URLQueryItem] = [], body: (any Encodable)? = nil
    ) async throws -> T {
        let (data, _) = try await send(try makeRequest(method, path, query: query, body: body))
        do {
            return try TempoJSON.decoder.decode(T.self, from: data)
        } catch {
            throw TempoAPIError.decoding(error)
        }
    }

    private func requestVoid(_ method: String, _ path: String, query: [URLQueryItem] = [], body: (any Encodable)? = nil) async throws {
        _ = try await send(try makeRequest(method, path, query: query, body: body))
    }
}

private struct AnyEncodable: Encodable {
    let value: any Encodable
    init(_ value: any Encodable) { self.value = value }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}
