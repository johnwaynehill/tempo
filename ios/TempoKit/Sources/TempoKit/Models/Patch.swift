import Foundation

/// A three-state field for partial updates. Wrap it in an Optional on the patch
/// struct: `nil` means "leave alone", `.set(x)` writes `x`, `.null` sends an explicit
/// JSON `null` to clear the column.
public enum Patch<Value: Codable & Hashable & Sendable>: Codable, Hashable, Sendable {
    case set(Value)
    case null

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        self = c.decodeNil() ? .null : .set(try c.decode(Value.self))
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .set(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }

    public var value: Value? {
        if case .set(let v) = self { return v }
        return nil
    }
}

extension KeyedEncodingContainer {
    /// Encodes a `Patch` only when it is non-nil; `.null` becomes JSON `null`.
    public mutating func encodePatch<V>(_ patch: Patch<V>?, forKey key: Key) throws {
        guard let patch else { return }
        switch patch {
        case .set(let v): try encode(v, forKey: key)
        case .null: try encodeNil(forKey: key)
        }
    }
}
