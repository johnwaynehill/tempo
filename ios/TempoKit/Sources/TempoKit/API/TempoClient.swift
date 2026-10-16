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
        return try await requestList("GET", "/api/todos", query: query)
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

    // MARK: Mood

    /// `POST /api/mood`. `value` is 1–100, the web mood slider's scale; the server also
    /// completes any habit with "mood" in its name for the day.
    public func logMood(value: Int, note: String? = nil) async throws -> MoodEntry {
        struct Body: Encodable { var value: Int; var note: String? }
        return try await request("POST", "/api/mood", body: Body(value: value, note: note))
    }

    /// The queued form: idempotent on `draft.id`, logged at `draft.createdAt`.
    public func logMood(_ draft: MoodDraft) async throws -> MoodEntry {
        try await request("POST", "/api/mood", body: draft)
    }

    /// `GET /api/mood?days=N` — entries from the last `days` days, newest first.
    public func moodHistory(days: Int = 7) async throws -> [MoodEntry] {
        try await request("GET", "/api/mood", query: [URLQueryItem(name: "days", value: String(days))])
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
        try await requestList("GET", "/api/events")
    }

    public func habits() async throws -> [Habit] {
        try await requestList("GET", "/api/habits")
    }

    public func createHabit(_ draft: HabitDraft) async throws -> Habit {
        try await request("POST", "/api/habits", body: draft)
    }

    public func updateHabit(id: UUID, _ update: HabitUpdate) async throws -> Habit {
        try await request("PUT", "/api/habits/\(id.uuidString.lowercased())", body: update)
    }

    public func deleteHabit(id: UUID) async throws {
        try await requestVoid("DELETE", "/api/habits/\(id.uuidString.lowercased())")
    }

    /// `date` is `yyyy-MM-dd`; the server keys `completions` by that string.
    public func toggleHabit(id: UUID, date: String, completed: Bool) async throws -> Habit {
        struct Body: Encodable { var date: String; var completed: Bool }
        return try await request("PATCH", "/api/habits/\(id.uuidString.lowercased())/completions", body: Body(date: date, completed: completed))
    }

    public func projects() async throws -> [Project] {
        try await requestList("GET", "/api/projects")
    }

    /// Returns the existing project when one with this name already exists.
    public func createProject(_ draft: ProjectDraft) async throws -> Project {
        try await request("POST", "/api/projects", body: draft)
    }

    /// Renames the todos that carry the old name too.
    public func renameProject(id: UUID, name: String) async throws -> Project {
        struct Body: Encodable { var name: String }
        return try await request("PUT", "/api/projects/\(id.uuidString.lowercased())", body: Body(name: name))
    }

    /// Clears the project from its todos (they aren't deleted).
    public func deleteProject(id: UUID) async throws {
        try await requestVoid("DELETE", "/api/projects/\(id.uuidString.lowercased())")
    }

    public func playlists() async throws -> [Playlist] {
        try await requestList("GET", "/api/playlists")
    }

    public func createPlaylist(_ draft: PlaylistDraft) async throws -> Playlist {
        try await request("POST", "/api/playlists", body: draft)
    }

    /// Full replace: `update.items` becomes the playlist's entire item list.
    public func updatePlaylist(id: UUID, _ update: PlaylistUpdate) async throws -> Playlist {
        try await request("PUT", "/api/playlists/\(id.uuidString.lowercased())", body: update)
    }

    public func deletePlaylist(id: UUID) async throws {
        try await requestVoid("DELETE", "/api/playlists/\(id.uuidString.lowercased())")
    }

    /// Creates `today_pinned` todos from the playlist's items.
    public func startPlaylist(id: UUID) async throws -> (todoIds: [UUID], count: Int) {
        struct Response: Decodable { var todoIds: [UUID]; var count: Int }
        let r: Response = try await request("POST", "/api/playlists/\(id.uuidString.lowercased())/start")
        return (r.todoIds, r.count)
    }

    // MARK: Notes

    public func notes() async throws -> [Note] {
        try await request("GET", "/api/notes")
    }

    public func createNote(_ draft: NoteDraft) async throws -> Note {
        try await request("POST", "/api/notes", body: draft)
    }

    public func updateNote(id: UUID, _ patch: NotePatch) async throws -> Note {
        try await request("PUT", "/api/notes/\(id.uuidString.lowercased())", body: patch)
    }

    public func deleteNote(id: UUID) async throws {
        try await requestVoid("DELETE", "/api/notes/\(id.uuidString.lowercased())")
    }

    // MARK: Weekly reviews

    public func reviews() async throws -> [WeeklyReview] {
        try await request("GET", "/api/reviews")
    }

    /// `id` is the week's Monday as `yyyy-MM-dd`; creates the row if it doesn't exist yet.
    public func updateReview(id: String, reflection: String) async throws -> WeeklyReview {
        struct Body: Encodable { var reflection: String }
        return try await request("PUT", "/api/reviews/\(id)", body: Body(reflection: reflection))
    }

    // MARK: Google Calendar

    public func googleCalendarStatus() async throws -> GoogleCalendarStatus {
        try await request("GET", "/api/google-calendar/status")
    }

    /// The consent URL to open in an `ASWebAuthenticationSession`; the server ties the
    /// eventual callback back to this user via a one-time state token. `?platform=ios`
    /// tells the callback to redirect to the app's `tempo://` scheme instead of the web app.
    public func googleCalendarConnectURL() async throws -> URL {
        struct Response: Decodable { var url: URL }
        let r: Response = try await request("GET", "/api/google-calendar/connect", query: [URLQueryItem(name: "platform", value: "ios")])
        return r.url
    }

    public func disconnectGoogleCalendar() async throws {
        try await requestVoid("DELETE", "/api/google-calendar")
    }

    public func syncGoogleCalendar() async throws {
        try await requestVoid("POST", "/api/google-calendar/sync")
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


    /// A list endpoint, decoded row by row: one row the client can't read (a new enum value, a
    /// malformed recurrence) is skipped and logged instead of failing the whole response, which
    /// would freeze the cache on stale data. If rows came back but *none* were readable it still
    /// throws, since an empty result there would wipe the cache.
    private func requestList<T: Decodable>(
        _ method: String, _ path: String, query: [URLQueryItem] = []
    ) async throws -> [T] {
        let (data, _) = try await send(try makeRequest(method, path, query: query, body: nil))
        do {
            let list = try TempoJSON.decoder.decode(LossyArray<T>.self, from: data)
            if list.skipped > 0 {
                print("TempoClient: skipped \(list.skipped) unreadable row(s) from \(path)")
                if list.elements.isEmpty { throw TempoAPIError.decoding(LossyArray<T>.AllRowsUnreadable()) }
            }
            return list.elements
        } catch let error as TempoAPIError {
            throw error
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

/// Decodes a JSON array, dropping elements that fail instead of failing the array.
struct LossyArray<Element: Decodable>: Decodable {
    struct AllRowsUnreadable: Error {}
    private struct Discard: Decodable { init(from decoder: Decoder) throws {} }

    var elements: [Element] = []
    var skipped = 0

    init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        while !container.isAtEnd {
            if let element = try? container.decode(Element.self) {
                elements.append(element)
            } else {
                skipped += 1
                // A failed decode doesn't advance the container; consume the bad element.
                _ = try container.decode(Discard.self)
            }
        }
    }
}
