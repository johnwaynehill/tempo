import Foundation
import Testing
@testable import TempoKit

@Suite struct SmartSuggestionsTests {
    @Test func decodesTheServerShape() throws {
        let json = #"{"suggestions":{"energyLevel":"low","size":"small","project":"Work","impact":3,"estimatedMinutes":5,"dueDate":"2026-10-23"}}"#
        struct Response: Decodable { var suggestions: SmartSuggestions? }
        let s = try #require(try TempoJSON.decoder.decode(Response.self, from: Data(json.utf8)).suggestions)
        #expect(s.energyLevel == .low)
        #expect(s.size == .small)
        #expect(s.project == "Work")
        #expect(s.impact == 3)
        #expect(s.estimatedMinutes == 5)
        let due = try #require(s.dueDate(calendar: LA.calendar))
        #expect(DayMath.isoDateString(due, calendar: LA.calendar) == "2026-10-23")
    }

    @Test func handPickedFieldsAreNeverOverwritten() {
        let s = SmartSuggestions(energyLevel: .high, size: .large, project: "Work", impact: 4, estimatedMinutes: 90, dueDate: "2026-10-23")
        let left = s.unsetOnly(energyLevel: .low, size: nil, project: "House", impact: nil, estimatedMinutes: nil, dueDate: Date())
        #expect(left.energyLevel == nil)
        #expect(left.project == nil)
        #expect(left.dueDate == nil)
        #expect(left.size == .large)
        #expect(left.impact == 4)
        #expect(left.estimatedMinutes == 90)
        #expect(SmartSuggestions().isEmpty)
    }
}
