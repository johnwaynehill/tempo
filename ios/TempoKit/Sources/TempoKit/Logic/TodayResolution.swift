import Foundation

/// Port of the "today todos" resolution in `src/hooks/useTodaySet.ts`.
public enum TodayResolution {
    /// Resolves the daily set's ids to todos: pinned first, then the set's ids in order.
    ///
    /// `todaySet` is a morning snapshot that isn't rewritten on every status change, so
    /// this is the defensive filter: set entries are kept only while still `todayPinned`
    /// or `backlog`; anything done, deferred, or moved back to inbox is dropped.
    /// When `today` is given and the set is for another day, only `pinned` is returned.
    public static func resolveTodayTodos(
        todaySet: TodaySet?, todos: [Todo], pinned: [Todo], today: String? = nil
    ) -> [Todo] {
        guard let todaySet else { return pinned }
        if let today, todaySet.date != today { return pinned }

        let todoMap = Dictionary(todos.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let pinnedIds = Set(pinned.map(\.id))

        let setTodos = todaySet.todoIds
            .filter { !pinnedIds.contains($0) }
            .compactMap { todoMap[$0] }
            .filter { $0.status == .todayPinned || $0.status == .backlog }

        return pinned + setTodos
    }

    /// `yyyy-MM-dd` for `now` in the calendar's zone (mirrors `todayDateString`).
    public static func todayDateString(now: Date = Date(), calendar: Calendar = .current) -> String {
        DayMath.isoDateString(now, calendar: calendar)
    }
}
