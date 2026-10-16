import SwiftUI
import TempoKit

/// Quick add with a few fields, created only when you hit Add — unlike the web's "+", which makes
/// an empty todo up front and deletes it if you leave it blank (and sometimes doesn't, leaving
/// Untitled rows behind). Defaults come from wherever it was opened, e.g. the Backlog's filters.
struct NewTodoSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var status: TodoStatus = .backlog
    @State var project: String?
    @State var energy: EnergyLevel?

    @State private var title = ""
    @FocusState private var focused: Bool

    private var canAdd: Bool { !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.grid * 2) {
                TextField("What needs doing?", text: $title, axis: .vertical)
                    .font(Theme.font(size: 17))
                    .foregroundStyle(Theme.onSurface)
                    .focused($focused)
                    .submitLabel(.done)
                    .onSubmit(add)
                    .padding(.vertical, Theme.grid * 1.5)
                    .padding(.horizontal, Theme.grid * 2)
                    .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                HStack(spacing: Theme.grid) {
                    Menu {
                        Button("No project") { project = nil }
                        ForEach(model.projectNames, id: \.self) { name in
                            Button(name) { project = name }
                        }
                    } label: {
                        FilterChip(title: project ?? "Project", isActive: project != nil)
                    }
                    Menu {
                        Button("No energy") { energy = nil }
                        ForEach(EnergyLevel.allCases, id: \.self) { level in
                            Button(TodoRow.label(for: level)) { energy = level }
                        }
                    } label: {
                        FilterChip(title: energy.map(TodoRow.label(for:)) ?? "Energy", isActive: energy != nil)
                    }
                    Spacer()
                }
                Spacer(minLength: 0)
            }
            .padding(Theme.grid * 2)
            .background(Theme.surface)
            .navigationTitle(status == .backlog ? "New in Backlog" : status == .todayPinned ? "New for Today" : "New todo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add", action: add).disabled(!canAdd)
                }
            }
        }
        .onAppear { focused = true }
    }

    private func add() {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let (status, project, energy) = (status, project, energy)
        Task { await model.createTodo(title: trimmed, status: status, project: project, energyLevel: energy) }
        dismiss()
    }
}

/// A filter or picker chip: the current value (or a placeholder) with a small chevron; sage when a
/// value is chosen. Used as the label of a `Menu`.
struct FilterChip: View {
    var title: String
    var isActive: Bool

    var body: some View {
        HStack(spacing: 4) {
            Text(title)
                .lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.system(size: 9, weight: .semibold))
        }
        .font(Theme.font(.caption, weight: .medium))
        .foregroundStyle(isActive ? Theme.onPrimary : Theme.onSurfaceVariant)
        .padding(.horizontal, Theme.grid * 1.5)
        .frame(minHeight: 32)
        .background(isActive ? Theme.primary : Theme.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}
