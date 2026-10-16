import SwiftUI
import TempoKit

/// Wrapped so the push doesn't collide with the `UUID` (todo detail) destination `TabStack` registers.
private struct LinkedNoteRoute: Hashable { let id: UUID }

/// One todo, editable in place. Mirrors `TodoDetailPage.tsx`: title and description
/// up top, the chip pickers below, a status-aware action bar pinned to the bottom.
/// Every change saves through `AppModel.update`; text fields debounce ~500 ms.
struct TodoDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss

    let id: UUID

    @State private var title = ""
    @State private var descriptionText = ""
    @State private var seededFor: UUID?
    @State private var titleSave: Task<Void, Never>?
    @State private var descriptionSave: Task<Void, Never>?
    @State private var confirmDelete = false
    /// Success haptic when Complete is tapped.
    @State private var completions = 0
    @FocusState private var focus: Field?
    /// Notes aren't cached offline; fetched for the link picker and the linked note's title.
    @State private var notes: [Note] = []
    @State private var notesLoaded = false
    @State private var openedNote: LinkedNoteRoute?
    @State private var noteError: String?

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
        .sensoryFeedback(.success, trigger: completions)
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
        .navigationDestination(item: $openedNote) { route in
            NoteEditorView(id: route.id, notes: $notes)
        }
        .alert("Couldn't update the note", isPresented: Binding(get: { noteError != nil }, set: { if !$0 { noteError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(noteError ?? "")
        }
        .task { await loadNotes() }
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
                    if let hint = estimateHint(todo) {
                        Text(hint)
                            .font(Theme.font(size: 11))
                            .foregroundStyle(Theme.onSurfaceVariant.opacity(0.7))
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

                field("Reminder") { reminderField(todo) }

                field("Repeat") { repeatField(todo) }

                field("Note") { noteField(todo) }
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

    // MARK: Reminder, repeat, note

    /// `ReminderPicker.tsx`'s quick picks, plus the exact picker once one is set.
    private func reminderField(_ todo: Todo) -> some View {
        HStack(spacing: Theme.grid) {
            if let at = todo.reminderAt {
                DatePicker(
                    "Reminder",
                    selection: Binding(get: { at }, set: { save(TodoPatch(reminderAt: .set($0))) }),
                    displayedComponents: [.date, .hourAndMinute]
                )
                .labelsHidden()
                .tint(Theme.primary)
            }
            Menu {
                let now = Date()
                Button("In 1 hour") { save(TodoPatch(reminderAt: .set(now.addingTimeInterval(3600)))) }
                Button("In 3 hours") { save(TodoPatch(reminderAt: .set(now.addingTimeInterval(3 * 3600)))) }
                Button("Tomorrow 9 AM") { save(TodoPatch(reminderAt: .set(DeferDates.tomorrow(calendar: model.calendar)))) }
                Button("Monday 9 AM") { save(TodoPatch(reminderAt: .set(DeferDates.nextMonday(calendar: model.calendar)))) }
                if todo.reminderAt != nil {
                    Divider()
                    Button("Remove reminder", systemImage: "bell.slash", role: .destructive) {
                        save(TodoPatch(reminderAt: .null))
                    }
                }
            } label: {
                if todo.reminderAt == nil {
                    Label("Add reminder", systemImage: "bell")
                        .font(Theme.font(.subheadline, weight: .medium))
                        .foregroundStyle(Theme.onSurface)
                        .padding(.horizontal, Theme.grid * 2)
                        .frame(minHeight: 44)
                        .background(Theme.surfaceContainer, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                } else {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.onSurfaceVariant)
                        .frame(width: 44, height: 44)
                        .background(Theme.surfaceContainer, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
            }
            .accessibilityLabel(todo.reminderAt == nil ? "Add reminder" : "Reminder options")
        }
    }

    /// `RecurrencePicker.tsx` inline: tap a frequency to set it (again to remove), then pick days.
    @ViewBuilder
    private func repeatField(_ todo: Todo) -> some View {
        let rule = todo.recurrence
        VStack(alignment: .leading, spacing: Theme.grid) {
            chipRow {
                ForEach([RecurrenceFrequency.daily, .weekly, .monthly], id: \.self) { frequency in
                    SelectableChip(label: frequency.rawValue.capitalized, isSelected: rule?.frequency == frequency) {
                        setFrequency(frequency, current: rule)
                    }
                }
            }

            if let rule, rule.frequency == .weekly {
                let days = rule.daysOfWeek ?? []
                HStack(spacing: 6) {
                    ForEach(0..<7, id: \.self) { day in
                        SelectableChip(label: Self.dayLetters[day], isSelected: days.contains(day), square: true) {
                            var updated = days.contains(day) ? days.filter { $0 != day } : (days + [day]).sorted()
                            if updated.isEmpty { updated = days }  // at least one day
                            save(TodoPatch(recurrence: .set(RecurrenceRule(frequency: .weekly, daysOfWeek: updated))))
                        }
                        .accessibilityLabel(Self.dayNames[day])
                    }
                }
            }

            if let rule, rule.frequency == .monthly {
                let day = rule.dayOfMonth ?? model.calendar.component(.day, from: Date())
                Stepper(value: Binding(
                    get: { day },
                    set: { save(TodoPatch(recurrence: .set(RecurrenceRule(frequency: .monthly, dayOfMonth: $0)))) }
                ), in: 1...31) {
                    Text("Day \(day) of the month")
                        .font(Theme.font(.subheadline))
                        .foregroundStyle(Theme.onSurface)
                }
            }

            if let rule {
                Text(Recurrence.describeRecurrence(rule))
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
        }
    }

    private func setFrequency(_ frequency: RecurrenceFrequency, current: RecurrenceRule?) {
        if current?.frequency == frequency {
            save(TodoPatch(recurrence: .null))
            return
        }
        let rule: RecurrenceRule
        switch frequency {
        case .daily:
            rule = RecurrenceRule(frequency: .daily)
        case .weekly:
            let today = model.calendar.component(.weekday, from: Date()) - 1
            rule = RecurrenceRule(frequency: .weekly, daysOfWeek: [today])
        case .monthly:
            rule = RecurrenceRule(frequency: .monthly, dayOfMonth: model.calendar.component(.day, from: Date()))
        }
        save(TodoPatch(recurrence: .set(rule)))
    }

    private static let dayLetters = ["S", "M", "T", "W", "T", "F", "S"]
    private static let dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    /// A linked note opens from here; otherwise link one that isn't linked yet, or start a new one.
    @ViewBuilder
    private func noteField(_ todo: Todo) -> some View {
        if let noteId = todo.noteId {
            let title = notes.first { $0.id == noteId }.map { $0.title.isEmpty ? "Untitled" : $0.title }
            HStack(spacing: Theme.grid) {
                Button {
                    openedNote = LinkedNoteRoute(id: noteId)
                } label: {
                    Label(title ?? (notesLoaded ? "Linked note" : "Loading…"), systemImage: "note.text")
                        .font(Theme.font(.subheadline, weight: .medium))
                        .foregroundStyle(Theme.primary)
                        .lineLimit(1)
                        .padding(.horizontal, Theme.grid * 2)
                        .frame(minHeight: 44)
                        .background(Theme.primary.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(title == nil)

                Button {
                    Task { await unlinkNote(noteId) }
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.onSurfaceVariant)
                        .frame(width: 44, height: 44)
                        .background(Theme.surfaceContainer, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Unlink note")
            }
        } else {
            Menu {
                Button("New note", systemImage: "plus") { Task { await createLinkedNote(todo) } }
                let unlinked = notes.filter { $0.linkedTodoId == nil }.sorted { $0.updatedAt > $1.updatedAt }
                if !unlinked.isEmpty {
                    Divider()
                    ForEach(unlinked.prefix(25)) { note in
                        Button(note.title.isEmpty ? "Untitled" : note.title) { Task { await linkNote(note.id) } }
                    }
                }
            } label: {
                Label("Link a note", systemImage: "link")
                    .font(Theme.font(.subheadline, weight: .medium))
                    .foregroundStyle(Theme.onSurface)
                    .padding(.horizontal, Theme.grid * 2)
                    .frame(minHeight: 44)
                    .background(Theme.surfaceContainer, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .disabled(session.client == nil)
        }
    }

    private func loadNotes() async {
        guard let client = session.client else { return }
        if let fetched = try? await client.notes() { notes = fetched }
        notesLoaded = true
    }

    /// Both sides of the link, as the web sets them: `todo.noteId` and `note.linkedTodoId`.
    private func linkNote(_ noteId: UUID) async {
        guard let client = session.client else { return }
        do {
            let note = try await client.updateNote(id: noteId, NotePatch(linkedTodoId: .set(id)))
            replace(note)
            save(TodoPatch(noteId: .set(noteId)))
        } catch {
            noteError = "Check your connection and try again."
        }
    }

    private func createLinkedNote(_ todo: Todo) async {
        guard let client = session.client else { return }
        do {
            let note = try await client.createNote(NoteDraft(title: todo.title, linkedTodoId: id))
            notes.append(note)
            save(TodoPatch(noteId: .set(note.id)))
            openedNote = LinkedNoteRoute(id: note.id)
        } catch {
            noteError = "Check your connection and try again."
        }
    }

    private func unlinkNote(_ noteId: UUID) async {
        save(TodoPatch(noteId: .null))
        guard let client = session.client,
              let note = try? await client.updateNote(id: noteId, NotePatch(linkedTodoId: .null)) else { return }
        replace(note)
    }

    private func replace(_ note: Note) {
        if let i = notes.firstIndex(where: { $0.id == note.id }) { notes[i] = note } else { notes.append(note) }
    }

    /// "Medium tasks usually take you about 45m." from the last four weeks of timed completions.
    private func estimateHint(_ todo: Todo) -> String? {
        guard let size = todo.size,
              let typical = Calibration.typicalMinutesForSize(model.todos.filter { $0.status == .done }, size: size)
        else { return nil }
        return "\(TodoRow.label(for: size)) tasks usually take you about \(TimeMath.formatMinutes(typical))."
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
            case .backlog:
                Button("Complete") {
                    completions += 1
                    finish { await model.complete(id: id) }
                }
                .buttonStyle(SecondaryButtonStyle())
                Button("Add to Today") { finish { await model.pin(id: id) } }
                    .buttonStyle(BarPrimaryButtonStyle())
            case .deferred:
                Button("Back to Backlog") { Task { await model.restoreFromDefer(id: id) } }
                    .buttonStyle(SecondaryButtonStyle())
                Button("Add to Today") { finish { await model.pin(id: id) } }
                    .buttonStyle(BarPrimaryButtonStyle())
            case .todayPinned:
                Button("Not today") { finish { await model.dismissFromToday(id: id) } }
                    .buttonStyle(SecondaryButtonStyle())
                Button("Complete") {
                    completions += 1
                    finish { await model.complete(id: id) }
                }
                .buttonStyle(BarPrimaryButtonStyle())
            case .done:
                Text("Completed \(completedLabel(todo.completedAt))")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
                    .frame(maxWidth: .infinity, minHeight: 44)
                Button("Not done") { Task { await model.uncomplete(id: id) } }
                    .buttonStyle(SecondaryButtonStyle())
            }
        }
        .padding(.horizontal, Theme.grid * 2)
        .padding(.vertical, Theme.grid * 1.5)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .background(Theme.surface.opacity(0.9))
    }

    /// "3:14 PM" today, "yesterday 3:14 PM", otherwise "Oct 3, 3:14 PM" — a bare time for a
    /// completion weeks ago reads as if it happened today.
    private func completedLabel(_ date: Date?) -> String {
        guard let date else { return "" }
        let time = TimeMath.formatClock(date)
        if model.calendar.isDateInToday(date) { return time }
        if model.calendar.isDateInYesterday(date) { return "yesterday \(time)" }
        return "\(date.formatted(.dateTime.month(.abbreviated).day())), \(time)"
    }

    private func overflowMenu(_ todo: Todo) -> some View {
        Menu {
            if todo.status != .todayPinned && todo.status != .done {
                Button("Complete", systemImage: "checkmark") {
                    completions += 1
                    finish { await model.complete(id: id) }
                }
            }
            if todo.status != .done {
                Menu("Defer") {
                    Button("Tomorrow") {
                        finish { await model.defer(id: id, until: DeferDates.tomorrow(calendar: model.calendar)) }
                    }
                    Button("Next week") {
                        finish { await model.defer(id: id, until: DeferDates.nextWeek(calendar: model.calendar)) }
                    }
                    Button("Next month") {
                        finish { await model.defer(id: id, until: DeferDates.nextMonth(calendar: model.calendar)) }
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
