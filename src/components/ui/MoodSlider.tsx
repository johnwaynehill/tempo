import { useState, useCallback } from 'react'
import { MoodFace } from './MoodFace'

interface MoodSliderProps {
  initialValue?: number
  onCommit: (value: number) => void
}

/**
 * Continuous mood slider (1-100) with morphing face.
 * Face updates during drag; onCommit fires on release.
 */
export function MoodSlider({ initialValue = 50, onCommit }: MoodSliderProps) {
  const [value, setValue] = useState(initialValue)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(Number(e.target.value))
  }, [])

  const handleCommit = useCallback(() => {
    onCommit(value)
  }, [onCommit, value])

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <MoodFace value={value} size={48} className="text-primary" />

      <div className="w-full px-1">
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={value}
          onChange={handleChange}
          onPointerUp={handleCommit}
          onTouchEnd={handleCommit}
          className="mood-slider w-full"
          aria-label="Mood level"
        />
      </div>

      <div className="flex justify-between w-full px-1">
        <span className="text-xs text-on-surface-variant">Awful</span>
        <span className="text-xs text-on-surface-variant">Great</span>
      </div>
    </div>
  )
}
