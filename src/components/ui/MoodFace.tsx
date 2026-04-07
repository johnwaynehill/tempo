interface MoodFaceProps {
  value: number // 1-100
  size?: number // default 48
  className?: string
}

/**
 * Geometric SVG face that morphs expression based on mood value.
 * 1 = deep frown (awful), 50 = flat line (okay), 100 = wide smile (great).
 */
export function MoodFace({ value, size = 48, className = '' }: MoodFaceProps) {
  // Normalize to -1 (awful) → 0 (okay) → +1 (great)
  const t = (value - 50) / 50

  // Mouth: quadratic bezier curve
  // At t=-1: deep frown, at t=0: flat, at t=+1: wide smile
  const mouthY = 32
  const mouthCurve = t * 8
  const mouthStartX = 14
  const mouthEndX = 34
  const mouthMidX = 24
  const mouthPath = `M ${mouthStartX},${mouthY - mouthCurve * 0.5} Q ${mouthMidX},${mouthY + mouthCurve * 1.5} ${mouthEndX},${mouthY - mouthCurve * 0.5}`

  // Eyes: slight vertical shift for expression
  const eyeY = 20 + t * -1.5 // droopier when sad, lifted when happy
  const eyeRadius = 2.2 + t * 0.3 // slightly smaller when sad

  // Eye squint on high happiness (happy eyes)
  const eyeScaleY = t > 0.5 ? 1 - (t - 0.5) * 0.6 : 1

  // Face fill opacity based on mood (warmer/more visible at extremes)
  const fillOpacity = 0.08 + Math.abs(t) * 0.07

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Head circle */}
      <circle
        cx="24"
        cy="24"
        r="22"
        fill="currentColor"
        fillOpacity={fillOpacity}
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.3"
      />

      {/* Left eye */}
      <ellipse
        cx="17"
        cy={eyeY}
        rx={eyeRadius}
        ry={eyeRadius * eyeScaleY}
        fill="currentColor"
        fillOpacity="0.7"
      />

      {/* Right eye */}
      <ellipse
        cx="31"
        cy={eyeY}
        rx={eyeRadius}
        ry={eyeRadius * eyeScaleY}
        fill="currentColor"
        fillOpacity="0.7"
      />

      {/* Mouth */}
      <path
        d={mouthPath}
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
