import { useNavigate } from 'react-router'
import { useHabits } from '@/hooks/useHabits'
import { useHabitStats } from '@/hooks/useHabitStats'
import { toISODateString } from '@/lib/dateUtils'
import type { Habit } from '@/types'

interface HabitRowProps {
  habit: Habit
}

export function HabitRow({ habit }: HabitRowProps) {
  const navigate = useNavigate()
  const { toggleCompletion } = useHabits()
  const stats = useHabitStats(habit)

  const today = toISODateString(new Date())
  const isCompletedToday = !!habit.completions[today]

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleCompletion(habit.id, today)
  }

  return (
    <button
      onClick={() => navigate(`/habits/${habit.id}`)}
      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-surface-container-low transition-colors duration-200 cursor-pointer rounded-xl group"
    >
      {/* Check-in circle */}
      <button
        onClick={handleToggle}
        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer ${
          isCompletedToday
            ? 'bg-primary border-primary'
            : 'border-outline-variant hover:border-primary'
        }`}
        aria-label={isCompletedToday ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompletedToday && (
          <svg className="w-3.5 h-3.5 text-on-primary" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5l3.5 3.5 6.5-7" />
          </svg>
        )}
      </button>

      {/* Habit name */}
      <span className="text-on-surface text-sm font-medium flex-1 text-left truncate">
        {habit.name}
      </span>

      {/* Streak */}
      <span className="text-on-surface-variant/60 text-xs shrink-0">
        {stats.currentStreak > 0 ? `${stats.currentStreak}d` : '---'}
      </span>

      {/* Chevron */}
      <svg className="w-4 h-4 text-on-surface-variant/40 shrink-0 group-hover:text-on-surface-variant transition-colors" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6 4l4 4-4 4" />
      </svg>
    </button>
  )
}
