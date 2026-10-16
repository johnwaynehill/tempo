import SwiftUI
import TempoKit

/// New habit, or edit an existing one's name and description. Mirrors `AddHabitModal.tsx`.
struct HabitEditorSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    /// Nil creates a new habit.
    var habit: Habit?

    @State private var name = ""
    @State private var description = ""
    @FocusState private var focused: Bool

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.grid * 1.5) {
                TextField("Name, e.g. Morning walk", text: $name)
                    .font(Theme.font(size: 17))
                    .focused($focused)
                    .submitLabel(.done)
                    .onSubmit(save)
                    .padding(.vertical, Theme.grid * 1.5)
                    .padding(.horizontal, Theme.grid * 2)
                    .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                TextField("Why it matters (optional)", text: $description, axis: .vertical)
                    .font(Theme.font(.subheadline))
                    .lineLimit(1...3)
                    .padding(.vertical, Theme.grid * 1.5)
                    .padding(.horizontal, Theme.grid * 2)
                    .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                Spacer(minLength: 0)
            }
            .padding(Theme.grid * 2)
            .background(Theme.surface)
            .navigationTitle(habit == nil ? "New habit" : "Edit habit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(habit == nil ? "Add" : "Save", action: save).disabled(trimmedName.isEmpty)
                }
            }
        }
        .onAppear {
            name = habit?.name ?? ""
            description = habit?.description ?? ""
            focused = true
        }
    }

    private func save() {
        let name = trimmedName
        guard !name.isEmpty else { return }
        let note = description.trimmingCharacters(in: .whitespacesAndNewlines)
        let existing = habit
        Task {
            if let existing {
                await model.updateHabit(id: existing.id, name: name, description: note)
            } else {
                await model.createHabit(name: name, description: note.isEmpty ? nil : note)
            }
        }
        dismiss()
    }
}
