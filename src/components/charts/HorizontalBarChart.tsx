interface BarData {
  label: string
  value: number
}

interface HorizontalBarChartProps {
  data: BarData[]
  maxBars?: number
}

export function HorizontalBarChart({ data, maxBars = 8 }: HorizontalBarChartProps) {
  if (data.length === 0) return null

  const visible = data.slice(0, maxBars)
  const maxValue = Math.max(...visible.map((d) => d.value), 1)

  return (
    <div className="space-y-2.5">
      {visible.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-on-surface-variant w-24 truncate shrink-0 text-right">
            {item.label}
          </span>
          <div className="flex-1 h-6 bg-surface-container rounded-lg overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-lg transition-all duration-500 ease-out"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="text-xs text-on-surface-variant w-8 text-right tabular-nums shrink-0">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}
