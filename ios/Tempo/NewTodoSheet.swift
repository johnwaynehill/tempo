import SwiftUI
import TempoKit

/// Quick add, created only when you hit Add — unlike the web's "+", which makes an empty todo up
/// front and deletes it if you leave it blank (and sometimes doesn't, leaving Untitled rows
/// behind). Mirrors the web's capture drawer (`TodoDetailDrawer.tsx`): title, an optional
/// description, Claude's suggested fields with one Apply, project chips, and a due date, plus
/// energy. Defaults come from wherever it was opened, e.g. the Backlog's filters.
struct NewTodoSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var status: TodoStatus = .backlog
    @State var project: String?
    @State var energy: EnergyLevel?

    @State private var title = ""
    @State private var descriptionText = ""
    @State private var showDescription = false
    @State private var size: TodoSize?
    @State private var impact: Int?
    @State private var estimatedMinutes: Int?
    @State private var dueDate: Date?

    /// The latest suggestions for the current title, and what's already been asked.
    @State private var suggestions: SmartSuggestions?
    @State private var suggestionCache: [String: SmartSuggestions] = [:]

    private enum Field { case title, description }
    @FocusState private var focus: Field?

    private var trimmedTitle: String { title.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canAdd: Bool { !trimmedTitle.isEmpty }

    /// What Apply would change: suggestions for fields you haven't set yourself.
    private var applicable: SmartSuggestions? {
        guard let suggestions else { return nil }
        let left = suggestions.unsetOnly(
            energyLevel: energy, size: size, project: project,
            impact: impact, estimatedMinutes: estimatedMinutes, dueDate: dueDate
        )
        return left.isEmpty ? nil : left
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.grid * 2.5) {
                    titleBlock

                    if let applicable {
                        suggestionLine(applicable)
                            .transition(.opacity)
                    }

                    if size != nil || impact != nil || estimatedMinutes != nil {
                        detailChips
                    }

                    field("Project") { projectChips }
                    field("Energy") { energyChips }
                    field("Due date") { dueDateField }
                }
                .padding(Theme.grid * 2)
                .animation(.easeOut(duration: 0.2), value: applicable)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.surface)
            .navigationTitle(status == .backlog ? "New in Backlog" : "New todo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add", action: add).disabled(!canAdd)
                }
            }
        }
        .onAppear { focus = .title }
        // Ask Claude once typing pauses (the web's 600 ms debounce, 5-character minimum).
        .task(id: trimmedTitle) { await suggest(for: trimmedTitle) }
    }

    // MARK: Sections

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            TextField("What needs doing?", text: $title, axis: .vertical)
                .font(Theme.font(size: 17))
                .foregroundStyle(Theme.onSurface)
                .focused($focus, equals: .title)
                .submitLabel(.done)
                .onSubmit(add)
                .padding(.vertical, Theme.grid * 1.5)
                .padding(.horizontal, Theme.grid * 2)
                .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            if showDescription {
                TextField("Add a description…", text: $descriptionText, axis: .vertical)
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .focused($focus, equals: .description)
                    .padding(.vertical, Theme.grid * 1.25)
                    .padding(.horizontal, Theme.grid * 2)
                    .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                Button("+ Add description") {
                    showDescription = true
                    focus = .description
                }
                .font(Theme.font(.caption))
                .foregroundStyle(Theme.onSurfaceVariant.opacity(0.7))
                .buttonStyle(.plain)
                .padding(.leading, 4)
            }
        }
    }

    /// `SmartCaptureSuggestions.tsx`: a quiet sparkle line and one Apply.
    private func suggestionLine(_ s: SmartSuggestions) -> some View {
        HStack(alignment: .center, spacing: Theme.grid) {
            Image(systemName: "sparkle")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.primary.opacity(0.6))
            Text(Self.summary(of: s, calendar: model.calendar))
                .font(Theme.font(.caption))
                .foregroundStyle(Theme.onSurfaceVariant)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            Button("Apply") { apply(s) }
                .font(Theme.font(.caption, weight: .semibold))
                .foregroundStyle(Theme.primary)
                .padding(.horizontal, Theme.grid * 1.25)
                .frame(minHeight: 32)
                .background(Theme.primary.opacity(0.1), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .buttonStyle(.plain)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Suggested: \(Self.summary(of: s, calendar: model.calendar))")
    }

    /// Size, impact and estimate have no picker here; once set (by Apply) they show as chips you
    /// can tap to clear. The todo's detail page has the full pickers.
    private var detailChips: some View {
        FlowLayout(spacing: 6) {
            if let size {
                clearableChip(TodoRow.label(for: size)) { self.size = nil }
            }
            if let impact {
                clearableChip("Impact \(impact)/5") { self.impact = nil }
            }
            if let estimatedMinutes {
                clearableChip(TimeMath.formatMinutes(estimatedMinutes)) { self.estimatedMinutes = nil }
            }
        }
    }

    private func clearableChip(_ text: String, clear: @escaping () -> Void) -> some View {
        Button(action: clear) {
            HStack(spacing: 4) {
                Text(text)
                Image(systemName: "xmark").font(.system(size: 8, weight: .bold))
            }
            .font(Theme.font(size: 12, weight: .medium))
            .foregroundStyle(Theme.onSurface)
            .padding(.horizontal, Theme.grid)
            .frame(minHeight: 28)
            .background(Theme.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(text), tap to remove")
    }

    /// `ProjectChips.tsx`: every project as a one-tap chip; tap the selected one to clear.
    @ViewBuilder
    private var projectChips: some View {
        let names = model.projectNames
        if names.isEmpty {
            Text("No projects yet. Add one from Projects.")
                .font(Theme.font(.caption))
                .foregroundStyle(Theme.onSurfaceVariant.opacity(0.7))
        } else {
            FlowLayout(spacing: 6) {
                ForEach(names, id: \.self) { name in
                    toggleChip(name, selected: project == name) {
                        project = project == name ? nil : name
                    }
                }
            }
        }
    }

    private var energyChips: some View {
        FlowLayout(spacing: 6) {
            ForEach(EnergyLevel.allCases, id: \.self) { level in
                toggleChip(TodoRow.label(for: level), selected: energy == level) {
                    energy = energy == level ? nil : level
                }
            }
        }
    }

    private func toggleChip(_ text: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(Theme.font(.caption, weight: .medium))
                .foregroundStyle(selected ? Theme.onPrimary : Theme.onSurfaceVariant)
                .padding(.horizontal, Theme.grid * 1.5)
                .frame(minHeight: 32)
                .background(selected ? Theme.primary : Theme.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    @ViewBuilder
    private var dueDateField: some View {
        if let dueDate {
            HStack(spacing: Theme.grid) {
                DatePicker("Due date", selection: Binding(get: { dueDate }, set: { self.dueDate = $0 }), displayedComponents: .date)
                    .labelsHidden()
                    .tint(Theme.primary)
                Button {
                    self.dueDate = nil
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.onSurfaceVariant)
                        .frame(width: 36, height: 36)
                        .background(Theme.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear due date")
            }
        } else {
            Button {
                dueDate = DayMath.startOfDay(Date(), calendar: model.calendar)
            } label: {
                Text("Add due date")
                    .font(Theme.font(.caption, weight: .medium))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .padding(.horizontal, Theme.grid * 1.5)
                    .frame(minHeight: 32)
                    .background(Theme.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            Text(label)
                .font(Theme.font(.caption, weight: .medium))
                .foregroundStyle(Theme.onSurfaceVariant)
            content()
        }
    }

    // MARK: Suggestions

    private func suggest(for title: String) async {
        guard title.count >= 5 else {
            suggestions = nil
            return
        }
        if let cached = suggestionCache[title] {
            suggestions = cached
            return
        }
        try? await Task.sleep(for: .milliseconds(600))
        guard !Task.isCancelled else { return }
        let result = await model.smartCapture(title: title)
        guard !Task.isCancelled else { return }
        if let result { suggestionCache[title] = result }
        suggestions = result
    }

    private func apply(_ s: SmartSuggestions) {
        if let v = s.energyLevel { energy = v }
        if let v = s.size { size = v }
        if let v = s.project { project = v }
        if let v = s.impact { impact = v }
        if let v = s.estimatedMinutes { estimatedMinutes = v }
        if let v = s.dueDate(calendar: model.calendar) { dueDate = v }
    }

    /// "Low energy · small · impact 3 · 5m · Work · due Oct 23", in the web's order.
    static func summary(of s: SmartSuggestions, calendar: Calendar) -> String {
        var parts: [String] = []
        if let v = s.energyLevel { parts.append("\(TodoRow.label(for: v)) energy") }
        if let v = s.size { parts.append(TodoRow.label(for: v).lowercased()) }
        if let v = s.impact { parts.append("impact \(v)") }
        if let v = s.estimatedMinutes { parts.append(TimeMath.formatMinutes(v)) }
        if let v = s.project { parts.append(v) }
        if let due = s.dueDate(calendar: calendar) {
            parts.append("due \(due.formatted(.dateTime.month(.abbreviated).day()))")
        }
        return parts.joined(separator: " · ")
    }

    // MARK: Add

    private func add() {
        guard canAdd else { return }
        let description = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
        let draft = TodoDraft(
            title: trimmedTitle,
            description: description.isEmpty ? nil : description,
            status: status,
            project: project,
            size: size,
            impact: impact,
            energyLevel: energy,
            dueDate: dueDate,
            estimatedMinutes: estimatedMinutes
        )
        Task { await model.createTodo(draft) }
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
