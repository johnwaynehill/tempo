import SwiftUI
import TempoKit

/// Today's compact mood entry point, like the row at the top of `Today.tsx`: the blob,
/// label and note once a mood is logged today, otherwise "How are you feeling?". Tapping
/// opens the check-in sheet. Refreshes on appear, after a save and when the scene is active.
struct MoodRow: View {
    @Environment(Session.self) private var session
    @Environment(\.scenePhase) private var scenePhase

    @State private var today = MoodTodayModel()
    @State private var showSheet = false
    @State private var saves = 0

    var body: some View {
        Button {
            showSheet = true
        } label: {
            label
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .padding(.vertical, 4)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.3), value: today.entry?.id)
        .sensoryFeedback(.success, trigger: saves)
        .sheet(isPresented: $showSheet) {
            MoodCheckInSheet(initialValue: today.entry?.value ?? 50) { entry in
                today.show(entry)
                saves += 1
                Task { await today.refresh(client: session.client) }
            }
            .environment(session)
        }
        .task {
            await today.refresh(client: session.client)
            #if DEBUG
            await DebugLaunch.runMood(
                client: session.client,
                openSheet: { showSheet = true },
                onSaved: { entry in
                    today.show(entry)
                    saves += 1
                }
            )
            #endif
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await today.refresh(client: session.client) }
        }
    }

    @ViewBuilder
    private var label: some View {
        if let entry = today.entry {
            let mood = Mood(value: entry.value)
            HStack(spacing: Theme.grid * 1.5) {
                MoodBlobView(value: Double(entry.value), size: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(mood.label)
                        .font(Theme.font(.subheadline, weight: .medium))
                        .foregroundStyle(Theme.onSurface)
                    if let note = entry.note, !note.isEmpty {
                        Text(note)
                            .font(Theme.font(.caption))
                            .foregroundStyle(Theme.onSurfaceVariant)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                }
                Spacer(minLength: Theme.grid)
                Text("Check in")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.6))
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Mood today: \(mood.label)\(entry.note.map { ", \($0)" } ?? ""). Check in again")
        } else {
            HStack(spacing: Theme.grid * 1.5) {
                Image(systemName: "face.smiling")
                    .font(.system(size: 20))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.7))
                    .frame(width: 32, height: 32)
                Text("How are you feeling?")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
                Spacer(minLength: Theme.grid)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.onSurfaceVariant.opacity(0.4))
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("How are you feeling? Log mood")
        }
    }
}

/// The check-in: a large blob that reshapes as the 1–100 slider moves (as `MoodSlider.tsx`
/// does), its label, an optional note, "Also save to Apple Health", and Save.
struct MoodCheckInSheet: View {
    var onSaved: (MoodEntry) -> Void

    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var value: Double
    @State private var note = ""
    @State private var saving = false
    @State private var message: String?
    @AppStorage(HealthMoodWriter.toggleDefaultsKey) private var alsoHealth = false
    @FocusState private var noteFocused: Bool

    private static let noteLimit = 140

    init(initialValue: Int, onSaved: @escaping (MoodEntry) -> Void) {
        self.onSaved = onSaved
        _value = State(initialValue: Double(min(100, max(1, initialValue))))
    }

    private var mood: Mood { Mood(value: Int(value.rounded())) }

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.grid * 3) {
                Text("How are you feeling?")
                    .font(Theme.display(.title3, weight: .semibold))
                    .foregroundStyle(Theme.onSurface)
                    .padding(.top, Theme.grid * 3)

                VStack(spacing: Theme.grid) {
                    ZStack {
                        Circle()
                            .fill(RadialGradient(
                                colors: [mood.body.opacity(0.35), mood.body.opacity(0)],
                                center: .center, startRadius: 0, endRadius: 96
                            ))
                            .frame(width: 192, height: 192)
                        MoodBlobView(value: value, size: 136)
                    }
                    .frame(height: 176)
                    .animation(.spring(duration: 0.35, bounce: 0.1), value: value)
                    .animation(.easeOut(duration: 0.3), value: mood)

                    Text(mood.label)
                        .font(Theme.display(.title3, weight: .semibold))
                        .foregroundStyle(mood.labelColor)
                        .contentTransition(.opacity)
                        .animation(.easeOut(duration: 0.3), value: mood)
                }

                VStack(spacing: Theme.grid) {
                    Slider(value: $value, in: 1...100, step: 1)
                        .tint(Theme.primary)
                        .accessibilityLabel("Mood level")
                        .accessibilityValue(mood.label)
                    HStack {
                        Text("Awful")
                        Spacer()
                        Text("Great")
                    }
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .accessibilityHidden(true)
                }
                .frame(maxWidth: 320)
                .sensoryFeedback(.selection, trigger: mood)

                VStack(spacing: Theme.grid * 1.5) {
                    TextField("What's going on? (optional)", text: $note, axis: .vertical)
                        .font(Theme.font(.body))
                        .foregroundStyle(Theme.onSurface)
                        .lineLimit(1...3)
                        .focused($noteFocused)
                        .submitLabel(.done)
                        .onChange(of: note) { _, new in
                            if new.count > Self.noteLimit { note = String(new.prefix(Self.noteLimit)) }
                            // A vertical TextField turns Return into a newline; treat it as done.
                            if new.contains("\n") {
                                note = new.replacingOccurrences(of: "\n", with: "")
                                noteFocused = false
                            }
                        }
                        .padding(.horizontal, Theme.grid * 2)
                        .padding(.vertical, 12)
                        .frame(minHeight: 48)
                        .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                    Toggle(isOn: $alsoHealth) {
                        Text("Also save to Apple Health")
                            .font(Theme.font(.subheadline))
                            .foregroundStyle(Theme.onSurface)
                    }
                    .tint(Theme.primary)
                    .padding(.horizontal, Theme.grid * 2)
                    .frame(minHeight: 48)
                    .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .onChange(of: alsoHealth) { _, on in
                        guard on else { message = nil; return }
                        Task { await checkHealthAccess() }
                    }
                }

                if let message {
                    Text(message)
                        .font(Theme.font(.footnote))
                        .foregroundStyle(Theme.onSurfaceVariant)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .transition(.opacity)
                }

                Button(action: save) {
                    Text(saving ? "Saving…" : "Save")
                }
                .buttonStyle(BarPrimaryButtonStyle())
                .disabled(saving)
                .opacity(saving ? 0.7 : 1)
            }
            .padding(.horizontal, Theme.grid * 3)
            .padding(.bottom, Theme.grid * 3)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
            .animation(.easeOut(duration: 0.3), value: message)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.surface.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Theme.surface)
    }

    /// Turning the toggle on asks for State of Mind write access right then.
    private func checkHealthAccess() async {
        let writer = HealthMoodWriter.shared
        guard writer.isAvailable else {
            message = "Apple Health isn't available on this device. Check-ins still save to Tempo."
            return
        }
        if await writer.requestAuthorization() {
            message = nil
        } else {
            message = "Tempo can't write to Apple Health yet. You can allow it in the Health app under Sharing → Apps. Check-ins still save to Tempo."
        }
    }

    private func save() {
        guard !saving else { return }
        guard let client = session.client else {
            message = "You're not signed in, so this can't be saved."
            return
        }
        noteFocused = false
        saving = true
        message = nil
        Task {
            let outcome = await MoodCheckIn.save(client: client, value: Int(value.rounded()), note: note, alsoHealth: alsoHealth)
            saving = false
            switch outcome {
            case .saved(let entry, let health):
                onSaved(entry)
                if health.needsNote {
                    message = "Saved to Tempo. Apple Health wasn't updated."
                    try? await Task.sleep(for: .seconds(1.8))
                } else {
                    try? await Task.sleep(for: .milliseconds(250))
                }
                dismiss()
            case .offline:
                message = "You're offline, so this didn't save. Try again once you're back online."
            case .failed:
                message = "Couldn't save just now. Try again in a moment."
            }
        }
    }
}

#Preview {
    MoodCheckInSheet(initialValue: 70) { _ in }
        .environment(Session())
}
