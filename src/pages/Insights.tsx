import { useState, useMemo } from 'react'
import { useTodos } from '@/hooks/useTodos'
import { useInsightsData } from '@/hooks/useInsightsData'
import { StatCard } from '@/components/charts/StatCard'
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart'
import { VerticalBarSeries } from '@/components/charts/VerticalBarSeries'
import { ProgressRing } from '@/components/charts/ProgressRing'
import { startOfDay } from '@/lib/dateUtils'

type TimeRange = '7d' | '30d' | '90d' | 'all'
type TrendMode = 'daily' | 'weekly' | 'monthly'

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
]

function getRangeFromOption(option: TimeRange): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()

  switch (option) {
    case '7d':
      start.setDate(start.getDate() - 6)
      break
    case '30d':
      start.setDate(start.getDate() - 29)
      break
    case '90d':
      start.setDate(start.getDate() - 89)
      break
    case 'all':
      start.setFullYear(2020, 0, 1)
      break
  }

  return { start: startOfDay(start), end }
}

export function InsightsPage() {
  const { done } = useTodos()
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [trendMode, setTrendMode] = useState<TrendMode>('daily')

  const range = useMemo(() => getRangeFromOption(timeRange), [timeRange])
  const data = useInsightsData(done, range)

  const hasDueDateTodos = data.completedOnTime + data.completedLate > 0
  const onTimePercent = hasDueDateTodos
    ? Math.round((data.completedOnTime / (data.completedOnTime + data.completedLate)) * 100)
    : 0

  const trendData =
    trendMode === 'daily'
      ? data.dailyTrend
      : trendMode === 'weekly'
        ? data.weeklyTrend
        : data.monthlyTrend

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Insights
          </h1>
          <p className="text-on-surface-variant text-sm">
            {timeRange === 'all'
              ? 'All time'
              : `Last ${timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : '90 days'}`}
          </p>
        </div>
      </div>

      {/* Time range selector */}
      <div className="flex gap-1.5 mb-8 overflow-x-auto scrollbar-hide">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTimeRange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer shrink-0 ${
              timeRange === opt.value
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {data.totalCompleted === 0 ? (
        <div className="text-center py-20 animate-gentle-appear">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L19 7" />
            </svg>
          </div>
          <p className="text-on-surface font-display font-semibold text-base mb-1">
            Fresh start
          </p>
          <p className="text-on-surface-variant text-sm">
            Complete your first task and come back to see your progress.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              title="Completed"
              value={data.totalCompleted}
              subtitle={`task${data.totalCompleted !== 1 ? 's' : ''} completed`}
              accent
            />
            <StatCard
              title="Streak"
              value={data.currentStreak > 0 ? `${data.currentStreak}d` : '—'}
              subtitle={
                data.currentStreak > 0
                  ? `day streak${data.bestStreak > data.currentStreak ? ` · best: ${data.bestStreak}d` : ''}`
                  : 'Complete a task today to start'
              }
            />
            <StatCard
              title="Pace"
              value={data.avgPerDay >= 1 ? data.avgPerDay.toFixed(1) : `~${data.avgPerDay.toFixed(1)}`}
              subtitle="per day average"
            />
          </div>

          {/* On-time performance */}
          {hasDueDateTodos && (
            <section>
              <h2 className="font-display text-base font-semibold text-on-surface mb-4">
                Timeliness
              </h2>
              <div className="bg-surface-container-lowest rounded-xl p-5 flex items-center gap-6">
                <ProgressRing value={onTimePercent} />
                <div>
                  <p className="font-display text-xl font-bold text-on-surface">
                    {onTimePercent}% on time
                  </p>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    {data.completedOnTime} on time · {data.completedLate} after due date
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* By project */}
          {data.byProject.length > 0 && (
            <section>
              <h2 className="font-display text-base font-semibold text-on-surface mb-4">
                By Project
              </h2>
              <div className="bg-surface-container-lowest rounded-xl p-5">
                <HorizontalBarChart
                  data={data.byProject.map((p) => ({
                    label: p.project,
                    value: p.count,
                  }))}
                />
              </div>
            </section>
          )}

          {/* Activity trend */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-on-surface">
                Activity
              </h2>
              <div className="flex gap-1">
                {(['daily', 'weekly', 'monthly'] as TrendMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTrendMode(mode)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                      trendMode === mode
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5">
              <VerticalBarSeries
                data={trendData}
                labelInterval={trendMode === 'daily' && trendData.length > 14 ? Math.ceil(trendData.length / 7) : undefined}
                highlightLast
              />
            </div>
          </section>

          {/* Most productive day */}
          {data.mostProductiveDay && (
            <div className="text-center pt-2">
              <p className="text-on-surface-variant/60 text-xs">
                Most productive day: {data.mostProductiveDay}
                {data.topProject && data.topProject !== 'Ungrouped'
                  ? ` · Top project: ${data.topProject}`
                  : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
