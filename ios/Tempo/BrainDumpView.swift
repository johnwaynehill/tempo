import SwiftUI
import TempoKit

/// Get it out of your head: one thought per line, all sent to Inbox in one go. Mirrors
/// `BrainDump.tsx`. Each line goes through the normal write queue, so this works offline too.
struct BrainDumpView: View {
    @Environment(AppModel.self) private var model
    @State private var text = ""
    @State private var sentCount: Int?
    @FocusState private var focused: Bool

    private var lines: [String] {
        text.split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.grid * 2) {
                PageHeader(title: "Brain Dump", subtitle: "Get it out of your head. One thought per line.")

                if let sentCount {
                    HStack {
                        Text("Sent \(sentCount) item\(sentCount == 1 ? "" : "s") to Inbox.")
                            .font(Theme.font(.subheadline))
                            .foregroundStyle(Theme.onSurface)
                        Spacer()
                        Button("View Inbox") { model.captureRequested = true }
                            .font(Theme.font(.subheadline, weight: .medium))
                            .foregroundStyle(Theme.primary)
                    }
                    .padding(Theme.grid * 2)
                    .background(Theme.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .transition(.opacity)
                }

                ZStack(alignment: .topLeading) {
                    if text.isEmpty {
                        Text("Buy groceries\nEmail dentist\nResearch that thing\n…")
                            .font(Theme.font(size: 16))
                            .foregroundStyle(Theme.onSurfaceVariant.opacity(0.4))
                            .padding(.top, 8)
                            .padding(.leading, 5)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $text)
                        .font(Theme.font(size: 16))
                        .foregroundStyle(Theme.onSurface)
                        .scrollContentBackground(.hidden)
                        .focused($focused)
                        .frame(minHeight: 280)
                }
                .padding(Theme.grid * 1.5)
                .background(Theme.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))

                Text("\(lines.count) item\(lines.count == 1 ? "" : "s")")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
            .padding(.horizontal, Theme.grid * 2)
            .padding(.top, Theme.grid)
        }
        .scrollDismissesKeyboard(.interactively)
        // In the toolbar, not under the editor: the keyboard is up the whole time you're dumping,
        // and it covered a button placed below the text.
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Send to Inbox", action: send)
                    .font(Theme.font(.subheadline, weight: .semibold))
                    .disabled(lines.isEmpty)
            }
        }
        .background(Theme.surface)
        .toolbarTitleDisplayMode(.inline)
        .animation(.easeOut(duration: 0.2), value: sentCount)
        .onChange(of: text) { _, new in if !new.isEmpty { sentCount = nil } }
        .onAppear { focused = true }
    }

    private func send() {
        let items = lines
        guard !items.isEmpty else { return }
        text = ""
        sentCount = items.count
        Task {
            for title in items {
                await model.createTodo(title: title, status: .inbox)
            }
        }
    }
}
