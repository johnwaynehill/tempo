import Foundation

/// Shared JSON coding for the Tempo API.
///
/// The API (Drizzle over Postgres) returns camelCase keys and ISO-8601 timestamps.
/// Most carry fractional seconds (`2026-09-12T22:27:24.667Z`), a few do not, so the
/// date strategy accepts both. Encoding always writes fractional seconds in UTC, which
/// keeps every date we send a full ISO-8601 string (see `TempoClient` for why that matters).
public enum TempoJSON {
    private static let fractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
    private static let whole = Date.ISO8601FormatStyle()

    /// Parses an ISO-8601 timestamp with or without fractional seconds.
    public static func parseDate(_ string: String) -> Date? {
        if let d = try? fractional.parse(string) { return d }
        if let d = try? whole.parse(string) { return d }
        return nil
    }

    /// Formats a date as `yyyy-MM-ddTHH:mm:ss.SSSZ` in UTC.
    public static func formatDate(_ date: Date) -> String {
        date.formatted(fractional)
    }

    public static var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            guard let date = parseDate(raw) else {
                throw DecodingError.dataCorruptedError(
                    in: container,
                    debugDescription: "Expected ISO-8601 date, got \"\(raw)\""
                )
            }
            return date
        }
        return decoder
    }

    public static var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(formatDate(date))
        }
        return encoder
    }
}
