import Foundation
import Testing
@testable import TempoKit

@Suite struct JSONTests {
    static let todoJSON = """
    {
      "id": "6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d",
      "userId": "uid_123",
      "firestoreId": null,
      "title": "Write brief",
      "description": null,
      "status": "today_pinned",
      "progress": null,
      "project": "Writing",
      "size": "large",
      "impact": 4,
      "energyLevel": "medium_low",
      "dueDate": "2026-09-14T07:00:00.000Z",
      "supports": null,
      "noteId": "0d9e8f7a-6b5c-4d3e-8f1a-2b3c4d5e6f70",
      "deferUntil": null,
      "reminderAt": null,
      "dismissedFromToday": null,
      "estimatedMinutes": 45,
      "startedAt": "2026-09-12T22:27:24.667Z",
      "actualMinutes": 12,
      "recurrence": { "frequency": "weekly", "days_of_week": [1, 3, 5] },
      "recurrenceParentId": null,
      "createdAt": "2026-09-01T15:04:05Z",
      "updatedAt": "2026-09-12T22:27:24.667Z",
      "completedAt": null
    }
    """

    @Test func decodesApiShapedTodo() throws {
        let todo = try TempoJSON.decoder.decode(Todo.self, from: Data(Self.todoJSON.utf8))
        #expect(todo.id == UUID(uuidString: "6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d"))
        #expect(todo.userId == "uid_123")
        #expect(todo.firestoreId == nil)
        #expect(todo.status == .todayPinned)
        #expect(todo.size == .large)
        #expect(todo.energyLevel == .mediumLow)
        #expect(todo.energyLevel?.ordinal == 1)
        #expect(todo.noteId == UUID(uuidString: "0d9e8f7a-6b5c-4d3e-8f1a-2b3c4d5e6f70"))
        #expect(todo.estimatedMinutes == 45)
        #expect(todo.actualMinutes == 12)
        #expect(todo.completedAt == nil)
        #expect(todo.recurrence == RecurrenceRule(frequency: .weekly, daysOfWeek: [1, 3, 5]))
        // Fractional and whole-second timestamps both parse.
        #expect(todo.startedAt == Date(timeIntervalSince1970: 1_789_252_044.667).rounded(to: 0.001))
        #expect(todo.createdAt == Date(timeIntervalSince1970: 1_788_275_045))
        #expect(todo.dueDate == LA.day(2026, 9, 14))
    }

    @Test func todoRoundTrip() throws {
        let todo = try TempoJSON.decoder.decode(Todo.self, from: Data(Self.todoJSON.utf8))
        let data = try TempoJSON.encoder.encode(todo)
        let back = try TempoJSON.decoder.decode(Todo.self, from: data)
        #expect(back == todo)

        let obj = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(obj["createdAt"] as? String == "2026-09-01T15:04:05.000Z")
        #expect(obj["startedAt"] as? String == "2026-09-12T22:27:24.667Z")
        let rec = try #require(obj["recurrence"] as? [String: Any])
        #expect(rec["days_of_week"] as? [Int] == [1, 3, 5])
        #expect(rec["daysOfWeek"] == nil)
        #expect(obj["completedAt"] == nil, "nil optionals are omitted, not null")
    }

    @Test func recurrenceRuleKeys() throws {
        let data = try TempoJSON.encoder.encode(RecurrenceRule(frequency: .monthly, dayOfMonth: 31))
        let obj = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(obj["day_of_month"] as? Int == 31)
        #expect(obj["frequency"] as? String == "monthly")
        let decoded = try TempoJSON.decoder.decode(RecurrenceRule.self, from: Data("{\"frequency\":\"daily\"}".utf8))
        #expect(decoded == RecurrenceRule(frequency: .daily))
    }

    @Test func dateStrategyRejectsGarbage() {
        #expect(TempoJSON.parseDate("2026-09-12T22:27:24.667Z") != nil)
        #expect(TempoJSON.parseDate("2026-09-12T22:27:24Z") != nil)
        #expect(TempoJSON.parseDate("2026-09-12T22:27:24+00:00") != nil)
        #expect(TempoJSON.parseDate("yesterday") == nil)
        #expect(TempoJSON.formatDate(Date(timeIntervalSince1970: 0)) == "1970-01-01T00:00:00.000Z")
        #expect(throws: TempoAPIError.self) {
            do {
                _ = try TempoJSON.decoder.decode(Todo.self, from: Data(Self.todoJSON.replacingOccurrences(of: "2026-09-01T15:04:05Z", with: "nope").utf8))
            } catch {
                throw TempoAPIError.decoding(error)
            }
        }
    }

    @Test func aiUsageSummary() throws {
        let json = """
        {"today":{"date":"2026-09-14","timezone":"America/Los_Angeles","spent_usd":0.4321,"cap_usd":2,"requests":7,"resets_at":"2026-09-15T07:00:00.000Z","exceeded":false},
         "history":[{"date":"2026-09-13","requests":3,"input_tokens":1200,"output_tokens":340,"spent_usd":0.0123}]}
        """
        let s = try TempoJSON.decoder.decode(AiUsageSummary.self, from: Data(json.utf8))
        #expect(s.today.spentUsd == 0.4321)
        #expect(s.today.capUsd == 2)
        #expect(s.today.requests == 7)
        #expect(s.today.exceeded == false)
        #expect(s.today.resetsAt == Date(timeIntervalSince1970: 1_789_455_600))
        #expect(s.history.count == 1)
        #expect(s.history[0].inputTokens == 1200)
        #expect(s.history[0].outputTokens == 340)
        let back = try TempoJSON.decoder.decode(AiUsageSummary.self, from: TempoJSON.encoder.encode(s))
        #expect(back == s)
        let obj = try #require(JSONSerialization.jsonObject(with: TempoJSON.encoder.encode(s)) as? [String: Any])
        let today = try #require(obj["today"] as? [String: Any])
        #expect(today["spent_usd"] != nil && today["spentUsd"] == nil)
    }

    @Test func todoPatchEncodesOnlyTouchedFields() throws {
        let patch = TodoPatch(title: .set("Renamed"), status: .set(.backlog), dueDate: .null, estimatedMinutes: .set(20))
        let data = try TempoJSON.encoder.encode(patch)
        let obj = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(Set(obj.keys) == ["title", "status", "dueDate", "estimatedMinutes"])
        #expect(obj["title"] as? String == "Renamed")
        #expect(obj["status"] as? String == "backlog")
        #expect(obj["dueDate"] is NSNull)
        #expect(obj["estimatedMinutes"] as? Int == 20)
        #expect(TodoPatch().isEmpty)
        #expect(!patch.isEmpty)
        let empty = try #require(JSONSerialization.jsonObject(with: TempoJSON.encoder.encode(TodoPatch())) as? [String: Any])
        #expect(empty.isEmpty)
    }

    @Test func todoDraftOmitsNil() throws {
        let draft = TodoDraft(title: "New", dueDate: LA.day(2026, 9, 14), recurrence: RecurrenceRule(frequency: .daily))
        let obj = try #require(JSONSerialization.jsonObject(with: TempoJSON.encoder.encode(draft)) as? [String: Any])
        #expect(Set(obj.keys) == ["title", "dueDate", "recurrence"])
        #expect(obj["dueDate"] as? String == "2026-09-14T07:00:00.000Z")
    }

    @Test func preferencesDefaultsFromServer() throws {
        let json = """
        {"userId":"uid_123","theme":"system","notificationsEnabled":false,"adaptiveTheme":false,"autoplanEnabled":false,"autoplanTimezone":"America/Los_Angeles","workDayStart":"09:00","workDayEnd":"17:00"}
        """
        let p = try TempoJSON.decoder.decode(UserPreferences.self, from: Data(json.utf8))
        #expect(p.currentEnergy == nil)
        #expect(p.autoplanLastRunDate == nil)
        #expect(p.theme == .system)
        #expect(p.workDayEnd == "17:00")
        let update = UserPreferencesUpdate(currentEnergy: .null, workDayStart: "08:30")
        let obj = try #require(JSONSerialization.jsonObject(with: TempoJSON.encoder.encode(update)) as? [String: Any])
        #expect(Set(obj.keys) == ["currentEnergy", "workDayStart"])
        #expect(obj["currentEnergy"] is NSNull)
    }

    @Test func otherModels() throws {
        let habit = try TempoJSON.decoder.decode(Habit.self, from: Data("""
        {"id":"6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d","userId":"u","firestoreId":null,"name":"Stretch","description":null,"frequency":"daily","archived":false,"completions":{"2026-09-13":true},"createdAt":"2026-09-01T15:04:05Z","updatedAt":"2026-09-01T15:04:05Z"}
        """.utf8))
        #expect(habit.isCompleted(on: "2026-09-13"))
        #expect(!habit.isCompleted(on: "2026-09-14"))

        let set = try TempoJSON.decoder.decode(TodaySet.self, from: Data("""
        {"userId":"u","date":"2026-09-14","todoIds":["6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d"]}
        """.utf8))
        #expect(set.todoIds.count == 1)
        #expect(set.id == "2026-09-14")

        let event = try TempoJSON.decoder.decode(CalendarEvent.self, from: Data("""
        {"id":"6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d","userId":"u","firestoreId":null,"title":"Standup","startTime":"2026-09-14T16:00:00.000Z","endTime":"2026-09-14T16:30:00.000Z","allDay":false,"description":null,"location":null,"color":"primary","source":"google","externalId":"abc","etag":"\\"1\\"","createdAt":"2026-09-01T15:04:05Z","updatedAt":"2026-09-01T15:04:05Z"}
        """.utf8))
        #expect(event.isReadOnly)
        #expect(event.color == .primary)
        #expect(event.externalId == "abc")

        let convo = try TempoJSON.decoder.decode(Conversation.self, from: Data("""
        {"id":"6f1c2a4e-3b7d-4e2a-9c1d-2f3e4a5b6c7d","userId":"u","firestoreId":null,"mode":"chat","todoId":null,"style":null,"title":"Hi","displayMessages":[{"role":"user","text":"hello","n":1}],"apiMessages":[],"createdAt":"2026-09-01T15:04:05Z","updatedAt":"2026-09-01T15:04:05Z"}
        """.utf8))
        #expect(convo.displayMessages[0]?["text"]?.stringValue == "hello")
        #expect(convo.displayMessages[0]?["n"]?.doubleValue == 1)
        #expect(convo.apiMessages == .array([]))
    }
}

private extension Date {
    func rounded(to step: TimeInterval) -> Date {
        Date(timeIntervalSince1970: (timeIntervalSince1970 / step).rounded() * step)
    }
}
