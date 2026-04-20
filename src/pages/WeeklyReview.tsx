import { useState, useMemo } from 'react'
import { useTodos } from '@/hooks/useTodos'
import { useInsightsData } from '@/hooks/useInsightsData'
import { useWeeklyReview } from '@/hooks/useWeeklyReview'
import { StatCard } from '@/components/charts/StatCard'
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart'
import { VerticalBarSeries } from '@/components/charts/VerticalBarSeries'
import {
  getStartOfWeek,
  getEndOfWeek,
  toISODateString,
  formatWeekLabel,
  eachDayOfRange,
  isSameDay,
  dayAbbrev,
} from '@/lib/dateUtils'

export function WeeklyReviewPage() {
  const { done } = useTodos()

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = useMemo(() => {
    const start = getStartOfWeek(new Date())
    start.setDate(start.getDate() + weekOffset * 7)
    return start
  }, [weekOffset])

  const weekEnd = useMemo(() => getEndOfWeek(weekStart), [weekStart])
  const weekId = toISODateString(weekStart)
  const isCurrentWeek = weekOffset === 0

  const range = useMemo(() => ({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])
  const data = useInsightsData(done, range)
  const { review, saveReflection } = useWeeklyReview(weekId)

  // Build 7-day mini trend (Mon-Sun)
  const weekDays = useMemo(() => {
    const days = eachDayOfRange(weekStart, weekEnd)
    const completedInRange = done.filter(
      (t) => t.completed_at && t.completed_at >= weekStart && t.completed_at <= weekEnd,
    )

    return days.map((day) => ({
      label: dayAbbrev(day),
      value: completedInRange.filter((t) => isSameDay(t.completed_at!, day)).length,
    }))
  }, [done, weekStart, weekEnd])

  // On-time stats
  const hasDueDateTodos = data.completedOnTime + data.completedLate > 0

  return (
    <div>
      {/* Header with week navigation */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Weekly Review
          </h1>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 4L6 8l4 4" />
            </svg>
          </button>
          <p className="text-on-surface-variant text-sm">
            {formatWeekLabel(weekStart)}
          </p>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            disabled={isCurrentWeek}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
            aria-label="Next week"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 4l4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      {data.totalCompleted === 0 ? (
        /* Empty week state */
        <div className="text-center py-20 animate-gentle-appear">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
            <span className="text-xl">~</span>
          </div>
          <p className="text-on-surface font-display font-semibold text-base mb-1">
            A quiet week
          </p>
          <p className="text-on-surface-variant text-sm">
            Nothing to review, and that&rsquo;s okay.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              title="Completed"
              value={data.totalCompleted}
              subtitle={`task${data.totalCompleted !== 1 ? 's' : ''}`}
              accent
            />
            <StatCard
              title="Avg / day"
              value={data.avgPerDay.toFixed(1)}
              subtitle="per day"
            />
            <StatCard
              title="Best day"
              value={data.mostProductiveDay ?? '—'}
              subtitle={data.mostProductiveDay ? `${Math.max(...weekDays.map((d) => d.value))} tasks` : ''}
            />
            <StatCard
              title="Top project"
              value={data.topProject && data.topProject !== 'Ungrouped' ? data.topProject : '—'}
              subtitle={data.topProject ? `${data.byProject[0]?.count ?? 0} tasks` : ''}
            />
          </div>

          {/* Week pulse — 7-day mini trend */}
          <section>
            <h2 className="font-display text-base font-semibold text-on-surface mb-4">
              This week
            </h2>
            <div className="bg-surface-container-lowest rounded-xl p-5">
              <VerticalBarSeries
                data={weekDays}
                height={120}
                highlightLast={isCurrentWeek}
              />
            </div>
          </section>

          {/* By project */}
          {data.byProject.length > 1 && (
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
                  maxBars={5}
                />
              </div>
            </section>
          )}

          {/* On-time */}
          {hasDueDateTodos && (
            <section>
              <div className="bg-surface-container-lowest rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${(data.completedOnTime / (data.completedOnTime + data.completedLate)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-on-surface-variant shrink-0">
                    {data.completedOnTime} of {data.completedOnTime + data.completedLate} on time
                  </span>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Reflection */}
      <section className="mt-10">
        <h2 className="font-display text-base font-semibold text-on-surface mb-3">
          Reflection
        </h2>
        <textarea
          key={weekId}
          defaultValue={review?.reflection ?? ''}
          onChange={(e) => saveReflection(e.target.value)}
          placeholder="What went well this week?"
          className="w-full bg-surface-container-lowest rounded-xl p-5 text-on-surface text-sm leading-relaxed outline-none resize-none min-h-[120px] placeholder:text-on-surface-variant/40"
          rows={4}
        />
        {review?.updated_at && (
          <p className="text-on-surface-variant/50 text-xs mt-2">
            Saved {review.updated_at.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}
      </section>
    </div>
  )
}
