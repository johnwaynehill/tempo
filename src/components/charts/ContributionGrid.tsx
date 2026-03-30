import { useMemo, useState } from 'react'

interface GridCell {
  date: string
  level: 0 | 1 | 2 | 3
}

interface ContributionGridProps {
  data: GridCell[]
  size?: number
  gap?: number
}

const LEVEL_CLASSES = [
  'fill-surface-container',           // 0: empty
  'fill-primary/25',                   // 1: low
  'fill-primary/50',                   // 2: medium
  'fill-primary/80',                   // 3: high
] as const

export function ContributionGrid({ data, size = 12, gap = 3 }: ContributionGridProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  // Group into weeks (columns of 7)
  const weeks = useMemo(() => {
    const result: GridCell[][] = []
    for (let i = 0; i < data.length; i += 7) {
      result.push(data.slice(i, i + 7))
    }
    return result
  }, [data])

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { text: string; col: number }[] = []
    let lastMonth = ''
    weeks.forEach((week, col) => {
      if (week.length > 0) {
        const d = new Date(week[0].date + 'T00:00:00')
        const month = d.toLocaleDateString('en-US', { month: 'short' })
        if (month !== lastMonth) {
          labels.push({ text: month, col })
          lastMonth = month
        }
      }
    })
    return labels
  }, [weeks])

  const dayLabels = ['', 'M', '', 'W', '', 'F', '']
  const labelWidth = 20
  const monthLabelHeight = 14
  const totalWidth = labelWidth + weeks.length * (size + gap)
  const totalHeight = monthLabelHeight + 7 * (size + gap)

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="block"
      >
        {/* Month labels */}
        {monthLabels.map(({ text, col }) => (
          <text
            key={`${text}-${col}`}
            x={labelWidth + col * (size + gap)}
            y={10}
            className="fill-on-surface-variant text-[9px]"
            fontSize="9"
          >
            {text}
          </text>
        ))}

        {/* Day labels */}
        {dayLabels.map((label, row) =>
          label ? (
            <text
              key={row}
              x={0}
              y={monthLabelHeight + row * (size + gap) + size * 0.8}
              className="fill-on-surface-variant text-[9px]"
              fontSize="9"
            >
              {label}
            </text>
          ) : null,
        )}

        {/* Grid cells */}
        {weeks.map((week, col) =>
          week.map((cell, row) => {
            const x = labelWidth + col * (size + gap)
            const y = monthLabelHeight + row * (size + gap)
            const d = new Date(cell.date + 'T00:00:00')
            const dateLabel = d.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
            const status =
              cell.level === 0 ? 'No activity' : cell.level === 1 ? 'Low' : cell.level === 2 ? 'Medium' : 'High'

            return (
              <rect
                key={cell.date}
                x={x}
                y={y}
                width={size}
                height={size}
                rx={2.5}
                className={`${LEVEL_CLASSES[cell.level]} transition-colors duration-200 cursor-default`}
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGRectElement).getBoundingClientRect()
                  setTooltip({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    text: `${dateLabel}: ${status}`,
                  })
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          }),
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 rounded-lg bg-on-surface text-surface text-[10px] font-medium pointer-events-none whitespace-nowrap -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
