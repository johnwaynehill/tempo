import SwiftUI
import TempoKit

/// Capture first, triage second. Mirrors `Inbox.tsx`: a field that is ready to type
/// into the moment the tab opens, then the list of what's waiting.
struct InboxView: View {
    @Environment(AppModel.self) private var model

    @State private var draft = ""
    @State private var processed = 0
    @FocusState private var captureFocused: Bool

    private var inbox: [Todo] { model.inbox }

    var body: some View {
        List {
            PageHeader(title: "Inbox", subtitle: subtitle)
                .plainRow(top: Theme.grid, bottom: Theme.grid * 2)

            captureField
                .plainRow(bottom: Theme.grid * 2)

            if let error = model.error, model.hasLoaded {
                Text(error)
                    .font(Theme.font(.footnote))
                    .foregroundStyle(Theme.error)
                    .plainRow(bottom: Theme.grid)
            }

            if !model.hasLoaded {
                HStack { Spacer(); ProgressView().tint(Theme.onSurfaceVariant); Spacer() }
                    .plainRow(top: Theme.grid * 8)
            } else if inbox.isEmpty {
                EmptyState(
                    symbol: "tray",
                    title: "Inbox zero",
                    message: processed > 0
                        ? "\(processed) item\(processed == 1 ? "" : "s") triaged. Nice work."
                        : "Nothing waiting. Enjoy the calm."
                )
                .plainRow()
            } else {
                ForEach(inbox) { todo in
                    TodoRow(todo: todo, showEnergy: false)
                        .navigates(to: todo.id)
                        .cardRow()
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            Button("Today", systemImage: "circle.circle") {
                                triage { await model.pin(id: todo.id) }
                            }
                            .tint(Theme.primary)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button("Delete", systemImage: "trash", role: .destructive) {
                                Task { await model.delete(id: todo.id) }
                            }
                            .tint(Theme.error)
                            Button("Backlog", systemImage: "list.bullet") {
                                triage { await model.moveToBacklog(id: todo.id) }
                            }
                            .tint(Theme.onSurfaceVariant)
                        }
                }
            }
        }
        .tempoList()
        .animation(.easeOut(duration: 0.3), value: inbox.map(\.id))
        .refreshable { await model.reload() }
        .toolbarTitleDisplayMode(.inline)
        .task { await model.loadIfNeeded() }
        .onAppear { captureFocused = true }
        .onChange(of: model.captureRequested, initial: true) { _, requested in
            // The Add to Tempo widget asked for capture — refocus even if this tab (and so
            // this view) was already alive and past its one-time onAppear.
            guard requested else { return }
            model.captureRequested = false
            captureFocused = true
        }
    }

    private var subtitle: String {
        var line = "\(inbox.count) item\(inbox.count == 1 ? "" : "s") to process"
        if processed > 0 { line += " · \(processed) triaged" }
        return line
    }

    private var captureField: some View {
        HStack(spacing: Theme.grid) {
            TextField("What's on your mind?", text: $draft)
                .font(Theme.font(size: 17))
                .foregroundStyle(Theme.onSurface)
                .submitLabel(.done)
                .focused($captureFocused)
                .onSubmit(capture)
                .accessibilityLabel("New todo")

            if !draft.trimmingCharacters(in: .whitespaces).isEmpty {
                Button(action: capture) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(Theme.primary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add")
                .transition(.opacity)
            }
        }
        .padding(.vertical, Theme.grid * 1.5)
        .padding(.horizontal, Theme.grid * 2)
        .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .animation(.easeOut(duration: 0.2), value: draft.isEmpty)
    }

    /// Enter creates the todo, clears the field, and keeps the keyboard up for the next one.
    private func capture() {
        let title = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        draft = ""
        captureFocused = true
        Task { await model.createTodo(title: title, status: .inbox) }
    }

    private func triage(_ action: @escaping () async -> Void) {
        Task {
            await action()
            processed += 1
        }
    }
}
