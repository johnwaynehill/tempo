import Foundation

/// `GET /api/ai-usage`. This one endpoint is served in **snake_case** on purpose,
/// so the coding keys are spelled out here instead of following the API's camelCase.
public struct AiUsageSummary: Codable, Hashable, Sendable {
    public struct Today: Codable, Hashable, Sendable {
        public var date: String
        public var timezone: String
        public var spentUsd: Double
        public var capUsd: Double
        public var requests: Int
        public var resetsAt: Date
        public var exceeded: Bool

        public init(date: String, timezone: String, spentUsd: Double, capUsd: Double, requests: Int, resetsAt: Date, exceeded: Bool) {
            self.date = date
            self.timezone = timezone
            self.spentUsd = spentUsd
            self.capUsd = capUsd
            self.requests = requests
            self.resetsAt = resetsAt
            self.exceeded = exceeded
        }

        private enum CodingKeys: String, CodingKey {
            case date, timezone, requests, exceeded
            case spentUsd = "spent_usd"
            case capUsd = "cap_usd"
            case resetsAt = "resets_at"
        }
    }

    public struct Day: Codable, Hashable, Sendable {
        public var date: String
        public var requests: Int
        public var inputTokens: Int
        public var outputTokens: Int
        public var spentUsd: Double

        public init(date: String, requests: Int, inputTokens: Int, outputTokens: Int, spentUsd: Double) {
            self.date = date
            self.requests = requests
            self.inputTokens = inputTokens
            self.outputTokens = outputTokens
            self.spentUsd = spentUsd
        }

        private enum CodingKeys: String, CodingKey {
            case date, requests
            case inputTokens = "input_tokens"
            case outputTokens = "output_tokens"
            case spentUsd = "spent_usd"
        }
    }

    public var today: Today
    public var history: [Day]

    public init(today: Today, history: [Day]) {
        self.today = today
        self.history = history
    }
}
