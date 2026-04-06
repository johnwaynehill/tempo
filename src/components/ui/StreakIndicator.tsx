interface StreakIndicatorProps {
  currentStreak: number
  hasCompletedToday: boolean
}

export function StreakIndicator({ currentStreak, hasCompletedToday }: StreakIndicatorProps) {
  if (currentStreak < 2) return null

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        hasCompletedToday ? 'text-primary/70' : 'text-on-surface-variant/50'
      }`}
    >
      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1c0 0-3 3.5-3 7a3 3 0 0 0 6 0c0-3.5-3-7-3-7zM6.5 9a1.5 1.5 0 0 0 3 0c0-1.5-1.5-3.5-1.5-3.5S6.5 7.5 6.5 9z" />
      </svg>
      {currentStreak} day streak
    </span>
  )
}
