import { formatMinutes } from '@/lib/time'

interface PairedRow {
  label: string
  estimated: number
  actual: number
}

interface PairedBarChartProps {
  rows: PairedRow[]
}

/** Two bars per row, estimated (muted) over actual (sage), in minutes. */
export function PairedBarChart({ rows }: PairedBarChartProps) {
  if (rows.length === 0) return null
  const max = Math.max(...rows.flatMap((r) => [r.estimated, r.actual]), 1)

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="text-xs text-on-surface-variant w-24 truncate shrink-0 text-right">
            {row.label}
          </span>
          <div className="flex-1 space-y-1">
            <div className="h-2 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-surface-container-highest rounded-full"
                style={{ width: `${(row.estimated / max) * 100}%` }}
              />
            </div>
            <div className="h-2 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/70 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(row.actual / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-on-surface-variant w-28 text-right tabular-nums shrink-0 whitespace-nowrap">
            {formatMinutes(row.estimated)} → {formatMinutes(row.actual)}
          </span>
        </div>
      ))}
    </div>
  )
}
