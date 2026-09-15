import Foundation

public enum TempoAPIError: Error, Sendable {
    /// Non-2xx response other than 401/403.
    case http(status: Int, body: String)
    /// 401 or 403.
    case unauthorized
    case decoding(any Error)
    case transport(any Error)
    /// The response was not an HTTP response at all.
    case invalidResponse
}

extension TempoAPIError: CustomStringConvertible {
    public var description: String {
        switch self {
        case .http(let status, let body): "HTTP \(status): \(body)"
        case .unauthorized: "Unauthorized"
        case .decoding(let error): "Decoding failed: \(error)"
        case .transport(let error): "Transport failed: \(error)"
        case .invalidResponse: "Invalid response"
        }
    }
}
