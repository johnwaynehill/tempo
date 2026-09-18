import Foundation
import HealthKit
import os

/// What happened on the Apple Health side of a check-in.
enum HealthMoodResult: Sendable, Equatable {
    /// The toggle was off.
    case skipped
    case saved
    /// Health isn't available on this device (iPad without Health, some simulators).
    case unavailable
    /// The person didn't allow Tempo to write State of Mind.
    case notAuthorized
    case failed

    /// Whether the sheet should mention that Health wasn't updated.
    var needsNote: Bool {
        switch self {
        case .skipped, .saved: false
        case .unavailable, .notAuthorized, .failed: true
        }
    }
}

/// Writes mood check-ins to Apple Health as State of Mind samples. Write only: the app
/// never asks to read Health data (there is no `NSHealthShareUsageDescription`).
///
/// Mapping from a Tempo check-in:
/// - `kind`: `.momentaryEmotion` (a check-in is how you feel right now, not a daily mood).
/// - `valence`: linear from 1–100 to −1…1, `(value − 1) / 99 × 2 − 1`, so 1 → −1,
///   50 → −0.01, 100 → 1.
/// - `labels`, one or two per bucket (`Mood(value:)`), picked to be gentle and broad:
///   - awful (1–15): `.sad`, `.overwhelmed`
///   - bad (16–35): `.stressed`, `.drained`
///   - meh (36–65): `.indifferent`
///   - good (66–85): `.content`, `.calm`
///   - great (86–100): `.happy`, `.joyful`
/// - The note stays in Tempo; State of Mind has no free-text field and a note is private.
@MainActor
final class HealthMoodWriter {
    static let shared = HealthMoodWriter()

    /// `UserDefaults` key for the sheet's "Also save to Apple Health" toggle (off by default).
    static let toggleDefaultsKey = "tempo-mood-save-to-health"

    private let store = HKHealthStore()
    private let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "health")

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    private var stateOfMindType: HKSampleType { HKSampleType.stateOfMindType() }

    static func valence(for value: Int) -> Double {
        let clamped = Double(min(100, max(1, value)))
        return (clamped - 1) / 99 * 2 - 1
    }

    static func labels(for mood: Mood) -> [HKStateOfMind.Label] {
        switch mood {
        case .awful: [.sad, .overwhelmed]
        case .bad: [.stressed, .drained]
        case .meh: [.indifferent]
        case .good: [.content, .calm]
        case .great: [.happy, .joyful]
        }
    }

    /// Asks for permission to write State of Mind if it hasn't been asked yet; returns whether
    /// writing is allowed now. Called when the toggle is switched on and before each save.
    @discardableResult
    func requestAuthorization() async -> Bool {
        let available = isAvailable
        log.info("authorization: isHealthDataAvailable=\(available)")
        guard available else { return false }
        let before = store.authorizationStatus(for: stateOfMindType)
        if before == .notDetermined {
            log.info("authorization: requesting share access to State of Mind")
            do {
                try await store.requestAuthorization(toShare: [stateOfMindType], read: [])
            } catch {
                log.error("authorization: request failed \(String(describing: error), privacy: .public)")
                return false
            }
        }
        let after = store.authorizationStatus(for: stateOfMindType)
        log.info("authorization: status before=\(before.rawValue) after=\(after.rawValue) (0 notDetermined, 1 denied, 2 authorized)")
        return after == .sharingAuthorized
    }

    func save(value: Int, date: Date) async -> HealthMoodResult {
        guard isAvailable else { return .unavailable }
        guard await requestAuthorization() else { return .notAuthorized }

        let sample = HKStateOfMind(
            date: date,
            kind: .momentaryEmotion,
            valence: Self.valence(for: value),
            labels: Self.labels(for: Mood(value: value)),
            associations: []
        )
        do {
            try await store.save(sample)
            log.info("save: State of Mind sample \(sample.uuid.uuidString, privacy: .public) valence=\(sample.valence) labels=\(sample.labels.map(\.rawValue), privacy: .public)")
            return .saved
        } catch {
            log.error("save: failed \(String(describing: error), privacy: .public)")
            return .failed
        }
    }

    #if DEBUG
    /// Reads back the newest State of Mind sample for the debug log. HealthKit only returns
    /// samples the app is allowed to read; with write-only access this may come back empty.
    func debugReadBack() async {
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.stateOfMind()],
            sortDescriptors: [SortDescriptor(\.startDate, order: .reverse)],
            limit: 1
        )
        do {
            let results = try await descriptor.result(for: store)
            if let newest = results.first {
                log.info("readback: newest State of Mind \(newest.uuid.uuidString, privacy: .public) date=\(newest.startDate.description, privacy: .public) kind=\(newest.kind.rawValue) valence=\(newest.valence) labels=\(newest.labels.map(\.rawValue), privacy: .public) source=\(newest.sourceRevision.source.bundleIdentifier, privacy: .public)")
            } else {
                log.info("readback: no State of Mind samples visible to the app")
            }
        } catch {
            log.info("readback: query failed \(String(describing: error), privacy: .public)")
        }
    }
    #endif
}
