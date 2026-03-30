import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useHabits } from '@/hooks/useHabits'
import { useHabitStats, useHabitGrid } from '@/hooks/useHabitStats'
import { StatCard } from '@/components/charts/StatCard'
import { ContributionGrid } from '@/components/charts/ContributionGrid'
import { AddHabitModal } from '@/components/habits/AddHabitModal'
import { DeleteHabitConfirm } from '@/components/habits/DeleteHabitConfirm'
import { toISODateString } from '@/lib/dateUtils'

export function HabitDetailPage() {
  const { habitId } = useParams<{ habitId: string }>()
  const navigate = useNavigate()
  const { habits, toggleCompletion, updateHabit, deleteHabit } = useHabits()

  const habit = habits.find((h) => h.id === habitId)

  const [showEdit, setShowEdit] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!habit) {
    return (
      <div className="text-center py-20">
        <p className="text-on-surface-variant text-sm">Habit not found.</p>
        <button
          onClick={() => navigate('/habits')}
          className="mt-4 text-primary text-sm font-medium cursor-pointer"
        >
          Back to Habits
        </button>
      </div>
    )
  }

  return <HabitDetailContent
    habit={habit}
    showEdit={showEdit}
    setShowEdit={setShowEdit}
    showDeleteConfirm={showDeleteConfirm}
    setShowDeleteConfirm={setShowDeleteConfirm}
    toggleCompletion={toggleCompletion}
    updateHabit={updateHabit}
    deleteHabit={deleteHabit}
    navigate={navigate}
  />
}

// Separate component so hooks work with guaranteed habit
function HabitDetailContent({
  habit,
  showEdit,
  setShowEdit,
  showDeleteConfirm,
  setShowDeleteConfirm,
  toggleCompletion,
  updateHabit,
  deleteHabit,
  navigate,
}: {
  habit: NonNullable<ReturnType<typeof import('@/hooks/useHabits').useHabits>['habits'][number]>
  showEdit: boolean
  setShowEdit: (v: boolean) => void
  showDeleteConfirm: boolean
  setShowDeleteConfirm: (v: boolean) => void
  toggleCompletion: (id: string, date: string) => Promise<void>
  updateHabit: (id: string, updates: { name?: string; description?: string }) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  navigate: ReturnType<typeof useNavigate>
}) {
  const stats = useHabitStats(habit)
  const gridData = useHabitGrid(habit)

  const today = toISODateString(new Date())
  const isCompletedToday = !!habit.completions[today]

  // Recent history: last 30 days
  const history = useMemo(() => {
    const days: { date: string; label: string; completed: boolean }[] = []
    const d = new Date()
    for (let i = 0; i < 30; i++) {
      const dateStr = toISODateString(d)
      days.push({
        date: dateStr,
        label: d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        completed: !!habit.completions[dateStr],
      })
      d.setDate(d.getDate() - 1)
    }
    return days
  }, [habit])

  return (
    <div>
      {/* Back button + title */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/habits')}
          className="flex items-center gap-1.5 text-on-surface-variant text-sm hover:text-on-surface transition-colors cursor-pointer mb-4"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 4L6 8l4 4" />
          </svg>
          Habits
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
              {habit.name}
            </h1>
            {habit.description && (
              <p className="text-on-surface-variant text-sm">{habit.description}</p>
            )}
          </div>

          {/* Today check-in (large) */}
          <button
            onClick={() => toggleCompletion(habit.id, today)}
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer ${
              isCompletedToday
                ? 'bg-primary border-primary'
                : 'border-outline-variant hover:border-primary'
            }`}
            aria-label={isCompletedToday ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompletedToday && (
              <svg className="w-5 h-5 text-on-primary" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5l3.5 3.5 6.5-7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard
          title="Streak"
          value={stats.currentStreak > 0 ? `${stats.currentStreak}d` : '---'}
          subtitle={stats.bestStreak > stats.currentStreak && stats.bestStreak > 0 ? `best: ${stats.bestStreak}d` : 'current'}
        />
        <StatCard
          title="Total"
          value={stats.totalCompletions}
          subtitle={`day${stats.totalCompletions !== 1 ? 's' : ''}`}
        />
        <StatCard
          title="Rate"
          value={`${stats.completionRate}%`}
          subtitle="completion"
        />
        <StatCard
          title="Since"
          value={habit.created_at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          subtitle={habit.created_at.getFullYear().toString()}
        />
      </div>

      {/* Contribution grid */}
      <section className="mb-8">
        <h2 className="font-display text-base font-semibold text-on-surface mb-4">
          Activity
        </h2>
        <div className="bg-surface-container-lowest rounded-xl p-5">
          <ContributionGrid data={gridData} />
        </div>
      </section>

      {/* Recent history */}
      <section className="mb-8">
        <h2 className="font-display text-base font-semibold text-on-surface mb-4">
          Last 30 days
        </h2>
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden divide-y divide-outline-variant/10">
          {history.map((day) => (
            <button
              key={day.date}
              onClick={() => toggleCompletion(habit.id, day.date)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <span className="text-on-surface text-sm">{day.label}</span>
              <span className={`text-xs font-medium ${day.completed ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                {day.completed ? 'Done' : '---'}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Actions */}
      <section className="space-y-3">
        <button
          onClick={() => setShowEdit(true)}
          className="w-full text-left bg-surface-container-lowest rounded-xl px-5 py-4 hover:bg-surface-container-low transition-colors cursor-pointer"
        >
          <p className="text-on-surface text-sm font-medium">Edit habit</p>
          <p className="text-on-surface-variant text-xs mt-0.5">Change name or description</p>
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full text-left bg-surface-container-lowest rounded-xl px-5 py-4 hover:bg-error/5 transition-colors cursor-pointer"
        >
          <p className="text-error text-sm font-medium">Delete habit</p>
          <p className="text-on-surface-variant text-xs mt-0.5">Permanently remove this habit and all history</p>
        </button>
      </section>

      {/* Edit modal */}
      {showEdit && (
        <AddHabitModal
          title="Edit Habit"
          initialName={habit.name}
          initialDescription={habit.description ?? ''}
          onSave={async (name, description) => {
            await updateHabit(habit.id, { name, description })
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <DeleteHabitConfirm
          habitName={habit.name}
          onConfirm={async () => {
            await deleteHabit(habit.id)
            navigate('/habits')
          }}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
