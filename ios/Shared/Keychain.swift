import Foundation
import Security

/// Generic-password Keychain items for Tempo, shared between the app and its extensions.
///
/// Items live in one access group — Info.plist's `TempoKeychainAccessGroup`, which expands to
/// `$(AppIdentifierPrefix)com.johnwaynehill.Tempo.shared` — so the widget, share extension and
/// App Intents can read the API key the app stored. Every target signed by the same team gets
/// that group through its `keychain-access-groups` entitlement (free personal teams included).
/// Items are readable after first unlock, which widget timeline refreshes need.
///
/// A build without entitlements (a simulator build with signing disabled) can't use access
/// groups; saves and reads there fall back to the target's default group so the app still works.
enum Keychain {
    static let service = "com.johnwaynehill.tempo"

    enum KeychainError: Error {
        case unexpectedStatus(OSStatus)
    }

    /// Nil when Info.plist doesn't declare a group or the build setting didn't expand.
    static let accessGroup: String? = {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "TempoKeychainAccessGroup") as? String,
              !group.isEmpty, !group.contains("$(") else { return nil }
        return group
    }()

    static func save(_ value: String, for key: String) throws {
        guard let group = accessGroup else {
            try save(value, for: key, group: nil)
            return
        }
        do {
            try save(value, for: key, group: group)
        } catch KeychainError.unexpectedStatus(let status) where status == errSecMissingEntitlement {
            try save(value, for: key, group: nil)
        }
    }

    /// Searches every group this process can see, so it finds shared, legacy and fallback items.
    static func read(_ key: String) -> String? {
        var query = baseQuery(key, group: nil)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Deletes the item from every group this process can see.
    static func delete(_ key: String) {
        SecItemDelete(baseQuery(key, group: nil) as CFDictionary)
    }

    /// Moves an item saved before sharing existed (the app's default group) into the shared
    /// group, so extensions can read it. Safe to call on every launch; a no-op once moved.
    static func migrateToSharedGroup(_ key: String) {
        guard let group = accessGroup else { return }

        var query = baseQuery(key, group: nil)
        query[kSecReturnAttributes as String] = true
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitAll
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let items = result as? [[String: Any]] else { return }

        let legacy = items.filter { ($0[kSecAttrAccessGroup as String] as? String) != group }
        guard !legacy.isEmpty else { return }
        let alreadyShared = items.count > legacy.count

        if !alreadyShared,
           let data = legacy.first?[kSecValueData as String] as? Data,
           let value = String(data: data, encoding: .utf8) {
            do {
                try save(value, for: key, group: group)
            } catch {
                return // No entitlement on this build: leave the legacy item where it is.
            }
        }
        for item in legacy {
            guard let itemGroup = item[kSecAttrAccessGroup as String] as? String else { continue }
            SecItemDelete(baseQuery(key, group: itemGroup) as CFDictionary)
        }
    }

    // MARK: Private

    private static func baseQuery(_ key: String, group: String?) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        if let group { query[kSecAttrAccessGroup as String] = group }
        return query
    }

    private static func save(_ value: String, for key: String, group: String?) throws {
        let query = baseQuery(key, group: group)
        let attributes: [String: Any] = [
            kSecValueData as String: Data(value.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess { return }
        guard updateStatus == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(updateStatus)
        }

        var insert = query
        insert.merge(attributes) { _, new in new }
        let addStatus = SecItemAdd(insert as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw KeychainError.unexpectedStatus(addStatus)
        }
    }
}
