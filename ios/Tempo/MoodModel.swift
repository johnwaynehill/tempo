import Foundation
import Observation
import SwiftUI
import TempoKit
import UIKit
import os

/// The five mood buckets from `MoodBlob.tsx`. A check-in is a 1–100 value; the bucket
/// only decides the label, the blob's colour and the Apple Health labels.
enum Mood: String, CaseIterable, Sendable {
    case awful, bad, meh, good, great

    /// `moodFromValue`: ≤15 awful, ≤35 bad, ≤65 meh, ≤85 good, otherwise great.
    init(value: Int) {
        switch value {
        case ...15: self = .awful
        case ...35: self = .bad
        case ...65: self = .meh
        case ...85: self = .good
        default: self = .great
        }
    }

    /// `MOOD_VALUES`: the centre of each bucket.
    var centerValue: Int {
        switch self {
        case .awful: 8
        case .bad: 25
        case .meh: 50
        case .good: 75
        case .great: 92
        }
    }

    /// `MOOD_LABELS`.
    var label: String {
        switch self {
        case .awful: "Awful"
        case .bad: "Bad"
        case .meh: "Meh"
        case .good: "Good"
        case .great: "Great"
        }
    }

    /// Blob body. The web uses warm pastels; here each bucket borrows a muted hue from the
    /// project chip palette in `Docs/Design.md` (Rose, Lavender, Slate, Sage, Moss) so the
    /// blob sits inside Quiet Rhythm. Dark mode uses the chip's light foreground as the body.
    var body: Color {
        switch self {
        case .awful: MoodPalette.color(light: 0xD8C0C8, dark: 0xC8A0AE)
        case .bad: MoodPalette.color(light: 0xCFC8D8, dark: 0xB8AEC4)
        case .meh: MoodPalette.color(light: 0xC8CCD0, dark: 0xA8B0B8)
        case .good: MoodPalette.color(light: 0xC0D8D0, dark: 0xA0C4B6)
        case .great: MoodPalette.color(light: 0xC8D4C0, dark: 0xB0C0A0)
        }
    }

    /// Face and label colour: the same chip's darker ink.
    var ink: Color {
        switch self {
        case .awful: MoodPalette.color(light: 0x5A3A44, dark: 0x40292F)
        case .bad: MoodPalette.color(light: 0x4A3E5A, dark: 0x352E40)
        case .meh: MoodPalette.color(light: 0x3E4448, dark: 0x2D3236)
        case .good: MoodPalette.color(light: 0x3A5248, dark: 0x2A3F37)
        case .great: MoodPalette.color(light: 0x44523A, dark: 0x2F3D27)
        }
    }

    /// Label text on the page surface; the ink is too dark to read on dark surfaces.
    var labelColor: Color {
        switch self {
        case .awful: MoodPalette.color(light: 0x5A3A44, dark: 0xC8A0AE)
        case .bad: MoodPalette.color(light: 0x4A3E5A, dark: 0xB8AEC4)
        case .meh: MoodPalette.color(light: 0x3E4448, dark: 0xA8B0B8)
        case .good: MoodPalette.color(light: 0x3A5248, dark: 0xA0C4B6)
        case .great: MoodPalette.color(light: 0x44523A, dark: 0xB0C0A0)
        }
    }
}

enum MoodPalette {
    static func color(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { trait in
            let hex = trait.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: 1
            )
        })
    }
}

/// What happened when a check-in was saved.
enum MoodSaveOutcome: Sendable, Equatable {
    /// Saved to Tempo; `health` says what happened on the Apple Health side.
    case saved(MoodEntry, health: HealthMoodResult)
    /// Couldn't reach the server. Mood logging isn't queued (it isn't a `WriteOp`).
    case offline
    case failed
}

/// The one save path shared by the check-in sheet and the `TEMPO_DEBUG_LOG_MOOD` hook.
@MainActor
enum MoodCheckIn {
    static let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "mood")

    /// `POST /api/mood`, then (when asked) a State of Mind sample. Health never blocks the
    /// Tempo save: it only runs once the server has the entry.
    static func save(client: TempoClient, value: Int, note: String?, alsoHealth: Bool) async -> MoodSaveOutcome {
        let clamped = min(100, max(1, value))
        let trimmed = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        let entry: MoodEntry
        do {
            entry = try await client.logMood(value: clamped, note: (trimmed?.isEmpty ?? true) ? nil : trimmed)
        } catch let error as TempoAPIError {
            log.info("save: failed \(String(describing: error), privacy: .public)")
            if case .transport = error { return .offline }
            return .failed
        } catch {
            log.info("save: failed \(String(describing: error), privacy: .public)")
            return .failed
        }
        log.info("save: logged mood \(entry.id.uuidString, privacy: .public) value=\(entry.value)")

        guard alsoHealth else { return .saved(entry, health: .skipped) }
        let health = await HealthMoodWriter.shared.save(value: clamped, date: entry.createdAt)
        log.info("save: health result \(String(describing: health), privacy: .public)")
        return .saved(entry, health: health)
    }

    /// The newest entry logged since local midnight, from `GET /api/mood?days=1`.
    static func todayEntry(client: TempoClient, calendar: Calendar = .current) async throws -> MoodEntry? {
        let start = calendar.startOfDay(for: Date())
        return try await client.moodHistory(days: 1)
            .filter { $0.createdAt >= start }
            .max { $0.createdAt < $1.createdAt }
    }
}

/// Today's mood row state. Owned by `MoodRow`; online only.
@Observable @MainActor
final class MoodTodayModel {
    private(set) var entry: MoodEntry?
    private(set) var hasLoaded = false

    func refresh(client: TempoClient?) async {
        guard let client else { return }
        do {
            entry = try await MoodCheckIn.todayEntry(client: client)
            hasLoaded = true
        } catch {
            // Offline or a hiccup: keep whatever was showing.
            MoodCheckIn.log.info("refresh: failed \(String(describing: error), privacy: .public)")
            hasLoaded = true
        }
    }

    /// Shows a just-saved entry without waiting for the refetch.
    func show(_ entry: MoodEntry) {
        self.entry = entry
        hasLoaded = true
    }
}
