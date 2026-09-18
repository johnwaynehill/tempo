import SwiftUI
import TempoKit

/// Port of `PlanMyDay.tsx`: a 5-step morning wizard — mood check-in, yesterday's recap,
/// picking today's tasks, setting estimates, and a confirmation that starts the day.
/// Reached from More → Plan My Day as a pushed screen; it draws its own top and bottom
/// bars rather than the system navigation bar, so it reads the same as the web's
/// full-bleed route whether it's pushed or (later) presented modally.
struct PlanMyDayView: View {
    @Environment(AppModel.self) private var model
    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss

    private enum Step: Int, CaseIterable {
        case checkin, yesterday, pick, estimates, ready
    }

    private static let maxSelected = 5
    private static let estimateChoices = [5, 15, 25, 45, 60, 90]

    @State private var step: Step = .checkin
    @State private var selectedMood: Mood?
    /// Today's candidate set, in selection order (pinned first, matching the web).
    @State private var selectedIds: [UUID] = []
    @State private var initialized = false
    @State private var starting = false

    private var stepIndex: Int { step.rawValue }

    // MARK: Derived

    private var energy: EnergyLevel? { model.preferences?.currentEnergy }

    private var yesterdayCompleted: [Todo] {
        let calendar = model.calendar
        let today = DayMath.startOfDay(Date(), calendar: calendar)
        let yesterday = DayMath.adding(days: -1, to: today, calendar: calendar)
        return model.todos.filter { todo in
            guard todo.status == .done, let completedAt = todo.completedAt else { return false }
            return completedAt >= yesterday && completedAt < today
        }
    }

    /// A wider slate of suggestions than a single day's picks, used both to seed the
    /// initial selection and to fill the "more candidates" list below it.
    private var suggestions: [Todo] {
        Scoring.suggestTodayTodos(model.todos, currentEnergy: energy, pinnedCount: 0, limit: 8, now: Date(), calendar: model.calendar)
    }

    private var pinnedIds: Set<UUID> { Set(model.pinned.map(\.id)) }

    private var selectedTodos: [Todo] {
        let byId = Dictionary(uniqueKeysWithValues: model.todos.map { ($0.id, $0) })
        return selectedIds.compactMap { byId[$0] }
    }

    /// Backlog + suggestions, deduped, minus what's already picked, capped at 10.
    private var backlogCandidates: [Todo] {
        var seen = Set<UUID>()
        var result: [Todo] = []
        for todo in suggestions + model.backlog {
            guard !selectedIds.contains(todo.id), seen.insert(todo.id).inserted else { continue }
            result.append(todo)
            if result.count == 10 { break }
        }
        return result
    }

    private var totalMinutes: Int { TimeMath.totalEstimatedMinutes(selectedTodos) }

    private var endTime: String {
        TimeMath.formatClock(TimeMath.projectedEndTime(selectedTodos, timer: nil, now: Date()), calendar: model.calendar)
    }

    private var overcommitNote: String? {
        Availability.todayOvercommitMessage(
            todos: selectedTodos,
            timer: nil,
            events: model.todayEvents,
            dayStart: model.preferences?.workDayStart ?? Availability.DEFAULT_WORK_DAY_START,
            dayEnd: model.preferences?.workDayEnd ?? Availability.DEFAULT_WORK_DAY_END,
            calendar: model.calendar
        )
    }

    // MARK: Body

    var body: some View {
        VStack(spacing: 0) {
            topBar

            ScrollView {
                VStack {
                    content
                        .padding(.horizontal, Theme.grid * 3)
                        .padding(.vertical, Theme.grid * 4)
                }
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }

            bottomBar
        }
        .background(Theme.surface.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .animation(.easeOut(duration: 0.25), value: step)
        .task {
            await model.loadIfNeeded()
            initializeSelectionIfNeeded()
        }
        .onChange(of: model.hasLoaded) { _, _ in initializeSelectionIfNeeded() }
    }

    @ViewBuilder
    private var content: some View {
        switch step {
        case .checkin: checkinStep
        case .yesterday: yesterdayStep
        case .pick: pickStep
        case .estimates: estimatesStep
        case .ready: readyStep
        }
    }

    // MARK: Top & bottom bars

    private var topBar: some View {
        HStack {
            Button("Skip") { dismiss() }
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurfaceVariant)
                .frame(minHeight: 44)

            Spacer()

            HStack(spacing: Theme.grid * 0.75) {
                ForEach(Step.allCases, id: \.self) { s in
                    Circle()
                        .fill(s.rawValue <= stepIndex ? Theme.primary : Theme.surfaceContainerHigh)
                        .frame(width: 8, height: 8)
                }
            }
            .accessibilityHidden(true)

            Spacer()

            Text("\(stepIndex + 1)/\(Step.allCases.count)")
                .font(Theme.font(.caption))
                .foregroundStyle(Theme.onSurfaceVariant)
                .frame(width: 32, alignment: .trailing)
                .monospacedDigit()
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Theme.grid * 3)
        .padding(.top, Theme.grid * 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(stepIndex + 1) of \(Step.allCases.count)")
    }

    private var bottomBar: some View {
        HStack(spacing: Theme.grid * 1.5) {
            if stepIndex > 0, step != .ready {
                Button("Back", action: goBack)
                    .buttonStyle(SecondaryButtonStyle())
                    .fixedSize(horizontal: true, vertical: false)
            }

            Spacer()

            if step == .ready {
                Button(action: startDay) {
                    Text(starting ? "Starting…" : "Start my day")
                }
                .buttonStyle(BarPrimaryButtonStyle())
                .fixedSize(horizontal: true, vertical: false)
                .disabled(starting)
                .opacity(starting ? 0.7 : 1)
            } else {
                Button(action: goNext) {
                    Text(step == .checkin && selectedMood == nil ? "Skip" : "Next")
                }
                .buttonStyle(BarPrimaryButtonStyle())
                .fixedSize(horizontal: true, vertical: false)
            }
        }
        .padding(.horizontal, Theme.grid * 3)
        .padding(.top, Theme.grid)
        .padding(.bottom, max(Theme.grid * 2, Theme.grid))
    }

    // MARK: Step 1 — check-in

    private var checkinStep: some View {
        VStack(spacing: Theme.grid * 4) {
            VStack(spacing: Theme.grid) {
                Text("Good morning")
                    .font(Theme.display(.title, weight: .bold))
                    .foregroundStyle(Theme.onSurface)
                Text("How are you feeling right now?")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
            .multilineTextAlignment(.center)

            HStack(spacing: Theme.grid * 2) {
                ForEach(Mood.allCases, id: \.self) { mood in
                    moodOption(mood)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func moodOption(_ mood: Mood) -> some View {
        let isSelected = selectedMood == mood
        return Button {
            selectedMood = mood
        } label: {
            VStack(spacing: Theme.grid) {
                MoodBlobView(value: Double(mood.centerValue), size: isSelected ? 52 : 44)
                Text(mood.label)
                    .font(Theme.font(.caption, weight: isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? Theme.onSurface : Theme.onSurfaceVariant)
            }
            .padding(.vertical, Theme.grid)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(
                isSelected ? Theme.primary.opacity(0.1) : Color.clear,
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.2), value: isSelected)
        .accessibilityLabel(mood.label)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: Step 2 — yesterday

    private var yesterdayStep: some View {
        VStack(spacing: Theme.grid * 3) {
            VStack(spacing: Theme.grid) {
                Text(yesterdayCompleted.isEmpty ? "Fresh start" : "Yesterday")
                    .font(Theme.display(.title, weight: .bold))
                    .foregroundStyle(Theme.onSurface)
                Text(
                    yesterdayCompleted.isEmpty
                        ? "No tasks completed yesterday. No judgment — today is a new day."
                        : "You completed \(yesterdayCompleted.count) task\(yesterdayCompleted.count == 1 ? "" : "s") yesterday. Nice."
                )
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.onSurfaceVariant)
            }
            .multilineTextAlignment(.center)

            if !yesterdayCompleted.isEmpty {
                VStack(spacing: Theme.grid * 0.75) {
                    ForEach(yesterdayCompleted) { todo in
                        HStack(spacing: Theme.grid * 1.5) {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Theme.primary)
                            Text(todo.title)
                                .font(Theme.font(.subheadline))
                                .foregroundStyle(Theme.onSurface)
                                .lineLimit(1)
                                .truncationMode(.tail)
                            Spacer(minLength: Theme.grid)
                            if let project = todo.project, !project.isEmpty {
                                Text(project)
                                    .font(Theme.font(.caption))
                                    .foregroundStyle(Theme.onSurfaceVariant)
                                    .lineLimit(1)
                            }
                        }
                        .padding(.horizontal, Theme.grid * 2)
                        .frame(minHeight: 44)
                        .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: Step 3 — pick tasks

    private var pickStep: some View {
        VStack(alignment: .leading, spacing: Theme.grid * 3) {
            VStack(spacing: Theme.grid) {
                Text("Pick your tasks")
                    .font(Theme.display(.title, weight: .bold))
                    .foregroundStyle(Theme.onSurface)
                Text("Choose up to \(Self.maxSelected) tasks for today. \(selectedIds.count)/\(Self.maxSelected) selected.")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)

            if !selectedTodos.isEmpty {
                VStack(alignment: .leading, spacing: Theme.grid) {
                    SectionLabel(text: "Today's tasks")
                    VStack(spacing: Theme.grid * 0.75) {
                        ForEach(selectedTodos) { todo in
                            pickRow(todo, selected: true)
                        }
                    }
                }
            }

            if !backlogCandidates.isEmpty, selectedIds.count < Self.maxSelected {
                VStack(alignment: .leading, spacing: Theme.grid) {
                    SectionLabel(text: "Suggestions")
                    VStack(spacing: Theme.grid * 0.75) {
                        ForEach(backlogCandidates) { todo in
                            pickRow(todo, selected: false)
                        }
                    }
                }
            }
        }
    }

    private func pickRow(_ todo: Todo, selected: Bool) -> some View {
        Button {
            toggle(todo.id)
        } label: {
            HStack(spacing: Theme.grid * 1.5) {
                if selected {
                    ZStack {
                        RoundedRectangle(cornerRadius: 6, style: .continuous).fill(Theme.primary)
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Theme.onPrimary)
                    }
                    .frame(width: 20, height: 20)
                } else {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(Theme.outlineVariant.opacity(0.6), lineWidth: 2)
                        .frame(width: 20, height: 20)
                }

                Text(todo.title)
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurface)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Spacer(minLength: Theme.grid)

                if selected {
                    Text(TimeMath.formatMinutes(TimeMath.getEstimate(todo)))
                        .font(Theme.font(.caption))
                        .foregroundStyle(Theme.onSurfaceVariant)
                } else if let dueDate = todo.dueDate {
                    Text(Self.dueDateFormatter.string(from: dueDate))
                        .font(Theme.font(.caption))
                        .foregroundStyle(Theme.onSurfaceVariant)
                }
            }
            .padding(.horizontal, Theme.grid * 2)
            .frame(minHeight: 44)
            .background(
                selected ? Theme.primary.opacity(0.08) : Theme.surfaceContainerLow,
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Step 4 — estimates

    private var estimatesStep: some View {
        VStack(spacing: Theme.grid * 3) {
            VStack(spacing: Theme.grid) {
                Text("Time check")
                    .font(Theme.display(.title, weight: .bold))
                    .foregroundStyle(Theme.onSurface)
                Text("Set estimates for your tasks. Total: \(TimeMath.formatMinutes(totalMinutes))")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.onSurfaceVariant)
            }
            .multilineTextAlignment(.center)

            VStack(spacing: Theme.grid * 2) {
                ForEach(selectedTodos) { todo in
                    estimateCard(todo)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func estimateCard(_ todo: Todo) -> some View {
        VStack(alignment: .leading, spacing: Theme.grid) {
            Text(todo.title)
                .font(Theme.font(.subheadline, weight: .medium))
                .foregroundStyle(Theme.onSurface)
                .lineLimit(1)
                .truncationMode(.tail)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.grid) {
                    ForEach(Self.estimateChoices, id: \.self) { minutes in
                        estimateChip(todo, minutes: minutes)
                    }
                }
            }
        }
        .padding(Theme.grid * 2)
        .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func estimateChip(_ todo: Todo, minutes: Int) -> some View {
        let isSet = todo.estimatedMinutes == minutes
        return Button {
            setEstimate(todo.id, minutes: isSet ? nil : minutes)
        } label: {
            Text(minutes < 60 ? "\(minutes)m" : "\(minutes / 60)h")
                .font(Theme.font(.caption, weight: .medium))
                .foregroundStyle(isSet ? Theme.onPrimary : Theme.onSurfaceVariant)
                .padding(.horizontal, Theme.grid * 1.5)
                .frame(minHeight: 36)
                .background(
                    isSet ? Theme.primary : Theme.surfaceContainer,
                    in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                )
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: isSet)
    }

    // MARK: Step 5 — ready

    private var readyStep: some View {
        VStack(spacing: Theme.grid * 4) {
            VStack(spacing: Theme.grid * 2) {
                ZStack {
                    Circle().fill(Theme.primary.opacity(0.1)).frame(width: 64, height: 64)
                    Image(systemName: "checkmark")
                        .font(.system(size: 26, weight: .medium))
                        .foregroundStyle(Theme.primary)
                }

                VStack(spacing: Theme.grid) {
                    Text("Your day is set")
                        .font(Theme.display(.title, weight: .bold))
                        .foregroundStyle(Theme.onSurface)
                    Text("\(selectedTodos.count) task\(selectedTodos.count == 1 ? "" : "s") \u{00B7} \(TimeMath.formatMinutes(totalMinutes)) total")
                        .font(Theme.font(.subheadline))
                        .foregroundStyle(Theme.onSurfaceVariant)
                    Text("Done by ~\(endTime)")
                        .font(Theme.font(.subheadline))
                        .foregroundStyle(Theme.onSurfaceVariant)
                    if let overcommitNote {
                        Text(overcommitNote)
                            .font(Theme.font(.subheadline))
                            .foregroundStyle(Theme.onSurfaceVariant)
                            .frame(maxWidth: 360)
                            .padding(.top, Theme.grid)
                    }
                }
                .multilineTextAlignment(.center)
            }

            VStack(spacing: Theme.grid * 0.75) {
                ForEach(selectedTodos) { todo in
                    HStack(spacing: Theme.grid * 1.5) {
                        Circle().fill(Theme.primary).frame(width: 8, height: 8)
                        Text(todo.title)
                            .font(Theme.font(.subheadline))
                            .foregroundStyle(Theme.onSurface)
                            .lineLimit(1)
                            .truncationMode(.tail)
                        Spacer(minLength: Theme.grid)
                        Text(TimeMath.formatMinutes(TimeMath.getEstimate(todo)))
                            .font(Theme.font(.caption))
                            .foregroundStyle(Theme.onSurfaceVariant)
                    }
                    .padding(.horizontal, Theme.grid * 2)
                    .frame(minHeight: 44)
                    .background(Theme.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: Actions

    private func initializeSelectionIfNeeded() {
        guard !initialized, model.hasLoaded, !model.todos.isEmpty else { return }
        var ids = model.pinned.map(\.id)
        let suggested = Scoring.suggestTodayTodos(
            model.todos, currentEnergy: energy, pinnedCount: model.pinned.count,
            limit: Self.maxSelected, now: Date(), calendar: model.calendar
        )
        for todo in suggested where !ids.contains(todo.id) {
            ids.append(todo.id)
        }
        selectedIds = ids
        initialized = true
    }

    private func toggle(_ id: UUID) {
        if let index = selectedIds.firstIndex(of: id) {
            selectedIds.remove(at: index)
        } else if selectedIds.count < Self.maxSelected {
            selectedIds.append(id)
        }
    }

    private func setEstimate(_ id: UUID, minutes: Int?) {
        let patch = TodoPatch(estimatedMinutes: minutes.map { .set($0) } ?? .null)
        Task { await model.update(todo: id, patch: patch) }
    }

    private func goNext() {
        guard step != Step.allCases.last else { return }
        if step == .checkin, let mood = selectedMood, let client = session.client {
            Task { try? await client.logMood(value: mood.centerValue) }
        }
        step = Step(rawValue: step.rawValue + 1) ?? step
    }

    private func goBack() {
        guard step.rawValue > 0 else { return }
        step = Step(rawValue: step.rawValue - 1) ?? step
    }

    private func startDay() {
        guard !starting else { return }
        starting = true
        let alreadyPinned = pinnedIds
        let newPins = selectedIds.filter { !alreadyPinned.contains($0) }
        let finalSelection = selectedIds
        Task {
            for id in newPins {
                await model.pin(id: id)
            }
            await model.setTodaySet(todoIds: finalSelection)
            dismiss()
        }
    }

    private static let dueDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter
    }()
}
