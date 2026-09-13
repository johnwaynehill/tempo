import type { Todo } from '@/types'
import { typicalMinutesForSize, SIZE_LABEL } from '@/lib/calibration'
import { formatMinutes } from '@/lib/time'

interface EstimateHintProps {
  done: Todo[]
  size?: string
  className?: string
}

/** "Medium tasks usually take you about 45m." from the last four weeks of timed completions. */
export function EstimateHint({ done, size, className = '' }: EstimateHintProps) {
  if (!size) return null
  const typical = typicalMinutesForSize(done, size)
  if (typical === null) return null
  return (
    <p className={`text-[11px] text-on-surface-variant/70 ${className}`}>
      {SIZE_LABEL[size] ?? size} tasks usually take you about {formatMinutes(typical)}.
    </p>
  )
}
