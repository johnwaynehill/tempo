import SwiftUI
import TempoKit

/// One todo, editable in place. Mirrors `TodoDetailPage.tsx`: title and description
/// up top, the chip pickers below, a status-aware action bar pinned to the bottom.
/// Every change saves through `AppModel.update`; text fields debounce ~500 ms.
struct TodoDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    let id: UUID

    @State private var title = ""
    @State private var descriptionText = ""
    @State private var seededFor: UUID?
    @State private var titleSave: Task<Void, Never>?
    @State private var descriptionSave: Task<Void, Never>?
    @State private var confirmDelete = false
    @FocusState private var focus: Field?

    private enum Field { case title, description }

    private static let estimateOptions = [5, 15, 25, 45, 60, 90]

    var body: some View {
        Group {
            if let todo = model.todo(id: id) {
                content(todo)
            } else {
                EmptyState(symbol: "questionmark", title: "Todo not found", message: "It may have been deleted.")
                    .frame(maxHeight: .infinity, alignment: .top)
                    .padding(.horizontal, Theme.grid * 2)
            }
        }
        .background(Theme.surface.ignoresSafeArea())
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let todo = model.todo(id: id) {
                    overflowMenu(todo)
                }
            }
        }
        .confirmationDialog("Delete this todo?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                finish { await model.delete(id: id) }
            }
        }
        .onChange(of: model.todo(id: id)?.id, initial: true) { _, _ in
            seedIfNeeded()
        }
        .onDisappear {
            flushTitle()
            flushDescription()
        }
    }

    // MARK: Content

    private func content(_ todo: Todo) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.grid * 3) {
                titleBlock(todo)

                field("Energy") {
                    chipRow {
                        ForEach(EnergyLevel.allCases, id: \.self) { level in
                            SelectableChip(label: TodoRow.label(for: level), isSelected: todo.energyLevel == level) {
                                save(TodoPatch(energyLevel: todo.energyLevel == level ? .null : .set(level)))
                            }
                        }
                    }
                }

                field("Size") {
                    chipRow {
                        ForEach(TodoSize.allCases, id: \.self) { size in
                            SelectableChip(label: TodoRow.label(for: size), isSelected: todo.size == size) {
                                save(TodoPatch(size: todo.size == size ? .null : .set(size)))
                            }
                        }
                    }
                }

                field("Impact") {
                    chipRow {
                        ForEach(1...5, id: \.self) { n in
                            SelectableChip(label: "\(n)", isSelected: todo.impact == n, square: true) {
                                save(TodoPatch(impact: todo.impact == n ? .null : .set(n)))
                            }
                        }
                    }
                }

                field("Time estimate") {
                    chipRow {
                        ForEach(Self.estimateOptions, id: \.self) { mins in
                            SelectableChip(label: Self.estimateLabel(mins), isSelected: todo.estimatedMinutes == mins) {
                                save(TodoPatch(estimatedMinutes: todo.estimatedMinutes == mins ? .null : .set(mins)))
                            }
                        }
                    }
                }

                field("Project") { projectPicker(todo) }

                field("Due date") {
                    datePicker(
                        value: todo.dueDate,
                        components: .date,
                        addLabel: "Add due date",
                        defaultValue: DayMath.startOfDay(Date(), calendar: model.calendar)
                    ) { date in
                        save(TodoPatch(dueDate: date.map { .set(DayMath.startOfDay($0, calendar: model.calendar)) } ?? .null))
                    }
                }

                field("Reminder") {
                    datePicker(
                        value: todo.reminderAt,
                        components: [.date, .hourAndMinute],
                        addLabel: "Add reminder",
                        defaultValue: DeferDates.tomorrow(calendar: model.calendar)
                    ) { date in
                        save(TodoPatch(reminderAt: date.map { .set($0) } ?? .null))
                    }
                }

                if let rule = todo.recurrence {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.trianglehead.2.clockwise")
                            .font(.system(size: 11, weight: .semibold))
                        Text(Recurrence.describeRecurrence(rule))
                            .font(Theme.font(size: 12, weight: .medium))
                    }
                    .foregroundStyle(Theme.primary)
                    .padding(.vertical, 6)
                    .padding(.horizontal, Theme.grid * 1.5)
                    .background(Theme.primary.opacity(0.1), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .accessibilityLabel("Repeats \(Recurrence.describeRecurrence(rule))")
                }
            }
            .padding(.horizontal, Theme.grid * 2)
            .padding(.top, Theme.grid)
            .padding(.bottom, Theme.grid * 4)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) { actionBar(todo) }
    }

    private func titleBlock(_ todo: Todo) -> some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            TextField("Todo title…", text: $title, axis: .vertical)
                .font(Theme.display(.title))
                .foregroundStyle(Theme.onSurface)
                .tracking(-0.5)
                .focused($focus, equals: .title)
                .submitLabel(.done)
                .onChange(of: title) { _, _ in scheduleTitleSave() }
                .onSubmit { flushTitle(); focus = nil }

            if let project = todo.project, !project.isEmpty {
                Text(project)
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }

            TextField("Add a description…", text: $descriptionText, axis: .vertical)
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurfaceVariant)
                .lineSpacing(4)
                .focused($focus, equals: .description)
                .onChange(of: descriptionText) { _, _ in scheduleDescriptionSave() }
                .padding(.top, 4)
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

    /// Chips scroll sideways rather than wrap, as the web row does, so each keeps its 44pt hit area.
    private func chipRow<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.grid) { content() }
        }
        .scrollClipDisabled()
    }

    private func projectPicker(_ todo: Todo) -> some View {
        let current = todo.project.flatMap { $0.isEmpty ? nil : $0 }
        var names = model.projectNames
        if let current, !names.contains(current) { names.insert(current, at: 0) }

        return Menu {
            Button("No project") { save(TodoPatch(project: .null)) }
            if !names.isEmpty { Divider() }
            ForEach(names, id: \.self) { name in
                Button {
                    save(TodoPatch(project: .set(name)))
                } label: {
                    if name == current {
                        Label(name, systemImage: "checkmark")
                    } else {
                        Text(name)
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Text(current ?? "No project")
                    .font(Theme.font(.subheadline, weight: .medium))
                    .foregroundStyle(current == nil ? Theme.onSurfaceVariant : Theme.onSurface)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
            .padding(.horizontal, Theme.grid * 2)
            .frame(minHeight: 44)
            .background(Theme.surfaceContainer, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .accessibilityLabel("Project, \(current ?? "none")")
    }

    /// Nil shows an "Add …" chip; a value shows the picker plus a clear button.
    private func datePicker(
        value: Date?,
        components: DatePicker.Components,
        addLabel: String,
        defaultValue: Date,
        onChange: @escaping (Date?) -> Void
    ) -> some View {
        HStack(spacing: Theme.grid) {
            if let value {
                DatePicker(
                    addLabel,
                    selection: Binding(get: { value }, set: { onChange($0) }),
                    displayedComponents: components
                )
                .labelsHidden()
                .tint(Theme.primary)

                Button {
                    onChange(nil)
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.onSurfaceVariant)
                        .frame(width: 44, height: 44)
                        .background(Theme.surfaceContainer, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear")
            } else {
                Button(addLabel) { onChange(defaultValue) }
                    .buttonStyle(SecondaryButtonStyle())
            }
        }
    }

    // MARK: Actions

    @ViewBuilder
    private func actionBar(_ todo: Todo) -> some View {
        HStack(spacing: Theme.grid) {
            switch todo.status {
            case .inbox:
                Button("Backlog") { finish { await model.moveToBacklog(id: id) } }
                    .buttonStyle(SecondaryButtonStyle())
                Button("Add to Today") { finish { await model.pin(id: id) } }
                    .buttonStyle(BarPrimaryButtonStyle())
            case .backlog, .deferred:
                Button("Add to Today") { finish { await model.pin(id: id) } }
                    .buttonStyle(BarPrimaryButtonStyle())
            case .todayPinned:
                Button("Not today") { finish { await model.dismissFromToday(id: id) } }
                    .buttonStyle(SecondaryButtonStyle())
                Button("Complete") { finish { await model.complete(id: id) } }
                    .buttonStyle(BarPrimaryButtonStyle())
            case .done:
                Text("Completed\(todo.completedAt.map { " " + TimeMath.formatClock($0) } ?? "")")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
        }
        .padding(.horizontal, Theme.grid * 2)
        .padding(.vertical, Theme.grid * 1.5)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .background(Theme.surface.opacity(0.9))
    }

    private func overflowMenu(_ todo: Todo) -> some View {
        Menu {
            if todo.status != .todayPinned && todo.status != .done {
                Button("Complete", systemImage: "checkmark") { finish { await model.complete(id: id) } }
            }
            if todo.status != .done {
                Menu("Defer") {
                    Button("Tomorrow") {
                        finish { await model.defer(id: id, until: DeferDates.tomorrow(calendar: model.calendar)) }
                    }
                    Button("Next week") {
                        finish { await model.defer(id: id, until: DeferDates.nextWeek(calendar: model.calendar)) }
                    }
                }
            }
            Divider()
            Button("Delete", systemImage: "trash", role: .destructive) { confirmDelete = true }
        } label: {
            Image(systemName: "ellipsis")
                .foregroundStyle(Theme.onSurfaceVariant)
        }
        .accessibilityLabel("More actions")
    }

    /// Runs a status change, then pops back to the list the todo came from.
    private func finish(_ action: @escaping () async -> Void) {
        flushTitle()
        flushDescription()
        Task {
            await action()
            dismiss()
        }
    }

    // MARK: Saving

    private func save(_ patch: TodoPatch) {
        Task { await model.update(todo: id, patch: patch) }
    }

    private func seedIfNeeded() {
        guard let todo = model.todo(id: id), seededFor != todo.id else { return }
        seededFor = todo.id
        title = todo.title
        descriptionText = todo.description ?? ""
    }

    private func scheduleTitleSave() {
        titleSave?.cancel()
        titleSave = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            flushTitle()
        }
    }

    private func scheduleDescriptionSave() {
        descriptionSave?.cancel()
        descriptionSave = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            flushDescription()
        }
    }

    private func flushTitle() {
        titleSave?.cancel()
        titleSave = nil
        guard let todo = model.todo(id: id) else { return }
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != todo.title else { return }
        save(TodoPatch(title: .set(trimmed)))
    }

    private func flushDescription() {
        descriptionSave?.cancel()
        descriptionSave = nil
        guard let todo = model.todo(id: id) else { return }
        let trimmed = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed != (todo.description ?? "") else { return }
        save(TodoPatch(description: trimmed.isEmpty ? .null : .set(trimmed)))
    }

    private static func estimateLabel(_ mins: Int) -> String {
        if mins < 60 { return "\(mins)m" }
        if mins % 60 == 0 { return "\(mins / 60)h" }
        return "\(Double(mins) / 60)h".replacingOccurrences(of: ".0h", with: "h")
    }
}
