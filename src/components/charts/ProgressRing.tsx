interface ProgressRingProps {
  /** Value 0-100 */
  value: number
  size?: number
  strokeWidth?: number
  label?: string
}

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 8,
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(value, 100) / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        role="img"
        aria-label={`${Math.round(value)}% complete`}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-container-high"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="stroke-primary transition-all duration-700 ease-out"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      {label && (
        <p className="text-on-surface-variant text-xs">{label}</p>
      )}
    </div>
  )
}
