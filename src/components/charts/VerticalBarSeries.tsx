interface BarData {
  label: string
  value: number
}

interface VerticalBarSeriesProps {
  data: BarData[]
  height?: number
  /** Show every Nth label on x-axis (prevents crowding) */
  labelInterval?: number
  /** Highlight the last bar */
  highlightLast?: boolean
}

export function VerticalBarSeries({
  data,
  height = 140,
  labelInterval,
  highlightLast,
}: VerticalBarSeriesProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-on-surface-variant text-xs">No activity in this period</p>
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const interval = labelInterval ?? (data.length > 14 ? Math.ceil(data.length / 7) : 1)

  return (
    <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
      <div
        className="flex items-end gap-[3px]"
        style={{
          height: `${height}px`,
          minWidth: data.length > 10 ? `${data.length * 28}px` : undefined,
        }}
      >
        {data.map((item, i) => {
          const barHeight = item.value > 0 ? Math.max(4, (item.value / maxValue) * (height - 28)) : 0
          const isLast = highlightLast && i === data.length - 1

          return (
            <div
              key={`${item.label}-${i}`}
              className="flex flex-col items-center flex-1 min-w-[20px] justify-end"
              style={{ height: '100%' }}
            >
              {/* Count label */}
              {item.value > 0 && (
                <span className="text-[10px] text-on-surface-variant tabular-nums mb-0.5">
                  {item.value}
                </span>
              )}

              {/* Bar */}
              <div
                className={`w-full max-w-[20px] rounded-t-md transition-all duration-500 ease-out ${
                  isLast ? 'bg-primary' : 'bg-primary/60'
                }`}
                style={{ height: `${barHeight}px` }}
              />

              {/* X-axis label */}
              {i % interval === 0 && (
                <span className="text-[9px] text-on-surface-variant/60 mt-1 truncate w-full text-center">
                  {item.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
