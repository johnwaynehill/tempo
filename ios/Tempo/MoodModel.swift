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

/// The one save path shared by the check-in sheet and the `TEMPO_DEBUG_LOG_MOOD` hook.
@MainActor
enum MoodCheckIn {
    static let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "mood")

    /// Queues the check-in (it reaches Tempo now, or when the phone is back online), then, when
    /// asked, writes a State of Mind sample for the same moment. Health never blocks the Tempo save.
    static func save(model: AppModel, value: Int, note: String?, alsoHealth: Bool) async -> (entry: MoodEntry, health: HealthMoodResult) {
        let trimmed = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        let entry = await model.logMood(value: value, note: (trimmed?.isEmpty ?? true) ? nil : trimmed)
        log.info("save: queued mood \(entry.id.uuidString, privacy: .public) value=\(entry.value)")

        guard alsoHealth else { return (entry, .skipped) }
        let health = await HealthMoodWriter.shared.save(value: entry.value, date: entry.createdAt)
        log.info("save: health result \(String(describing: health), privacy: .public)")
        return (entry, health)
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
            let fetched = try await MoodCheckIn.todayEntry(client: client)
            // A check-in still waiting in the queue is newer than anything the server has.
            if let shown = entry, Calendar.current.isDateInToday(shown.createdAt),
               shown.createdAt > (fetched?.createdAt ?? .distantPast) {
                hasLoaded = true
                return
            }
            entry = fetched
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

    /// Drops a just-deleted entry; the next refresh brings back any earlier check-in from today.
    func clear() {
        entry = nil
    }
}
