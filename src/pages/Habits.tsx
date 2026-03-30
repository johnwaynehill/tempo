import { useState } from 'react'
import { useHabits } from '@/hooks/useHabits'
import { useAllHabitsGrid } from '@/hooks/useHabitStats'
import { MobileMenu } from '@/components/ui/MobileMenu'
import { HabitRow } from '@/components/habits/HabitRow'
import { AddHabitModal } from '@/components/habits/AddHabitModal'
import { ContributionGrid } from '@/components/charts/ContributionGrid'
import { toISODateString } from '@/lib/dateUtils'

export function HabitsPage() {
  const { activeHabits, loading, addHabit } = useHabits()
  const [showAddModal, setShowAddModal] = useState(false)
  const gridData = useAllHabitsGrid(activeHabits)

  const today = toISODateString(new Date())
  const completedToday = activeHabits.filter((h) => h.completions[today]).length

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Habits
          </h1>
          {activeHabits.length > 0 && (
            <p className="text-on-surface-variant text-sm">
              {completedToday} of {activeHabits.length} done today
            </p>
          )}
        </div>
        <MobileMenu />
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : activeHabits.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20 animate-gentle-appear">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </div>
          <p className="text-on-surface font-display font-semibold text-base mb-1">
            No habits yet
          </p>
          <p className="text-on-surface-variant text-sm mb-6">
            Start small — even one is a win.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:shadow-md transition-all cursor-pointer"
          >
            Create your first habit
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Habit list */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-semibold text-on-surface">
                Today
              </h2>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-primary text-xs font-medium hover:text-primary/80 transition-colors cursor-pointer"
              >
                + New habit
              </button>
            </div>
            <div className="bg-surface-container-lowest rounded-xl overflow-hidden divide-y divide-outline-variant/10">
              {activeHabits.map((habit) => (
                <HabitRow key={habit.id} habit={habit} />
              ))}
            </div>
          </section>

          {/* Quick check-all / uncheck-all - only show if there are unchecked habits */}
          {completedToday === activeHabits.length && activeHabits.length > 0 && (
            <div className="text-center animate-gentle-appear">
              <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L19 7" />
                </svg>
              </div>
              <p className="text-on-surface font-display font-semibold text-sm">
                All habits done
              </p>
              <p className="text-on-surface-variant/60 text-xs mt-0.5">
                Consistency is the goal, not perfection.
              </p>
            </div>
          )}

          {/* Contribution grid */}
          <section>
            <h2 className="font-display text-base font-semibold text-on-surface mb-4">
              Activity
            </h2>
            <div className="bg-surface-container-lowest rounded-xl p-5">
              <ContributionGrid data={gridData} />
              {/* Legend */}
              <div className="flex items-center justify-end gap-1.5 mt-3">
                <span className="text-on-surface-variant/50 text-[10px]">Less</span>
                {[0, 1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className={`w-3 h-3 rounded-sm ${
                      level === 0
                        ? 'bg-surface-container'
                        : level === 1
                          ? 'bg-primary/25'
                          : level === 2
                            ? 'bg-primary/50'
                            : 'bg-primary/80'
                    }`}
                  />
                ))}
                <span className="text-on-surface-variant/50 text-[10px]">More</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Add modal */}
      {showAddModal && (
        <AddHabitModal
          onSave={async (name, description) => {
            await addHabit({ name, description })
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
