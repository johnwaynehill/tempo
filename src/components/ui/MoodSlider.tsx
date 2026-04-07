import { useState, useCallback, useRef, useEffect } from 'react'
import { MoodBlob, moodFromValue, MOOD_LABELS, BLOB_COLORS, type MoodKey } from './MoodBlob'

interface MoodSliderProps {
  initialValue?: number
  onCommit: (value: number) => void
  /** Compact mode for PlanMyDay */
  compact?: boolean
}


/**
 * Continuous mood slider (1-100) with a single animated blob character.
 * The blob cross-fades between moods as the slider moves through thresholds.
 */
export function MoodSlider({ initialValue = 50, onCommit, compact = false }: MoodSliderProps) {
  const [value, setValue] = useState(initialValue)
  const [prevMood, setPrevMood] = useState<MoodKey | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const currentMood = moodFromValue(value)
  const lastMoodRef = useRef(currentMood)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Detect mood changes and trigger cross-fade
  useEffect(() => {
    if (currentMood !== lastMoodRef.current) {
      setPrevMood(lastMoodRef.current)
      setTransitioning(true)
      lastMoodRef.current = currentMood

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setTransitioning(false)
        setPrevMood(null)
      }, 300)
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [currentMood])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(Number(e.target.value))
  }, [])

  const handleCommit = useCallback(() => {
    onCommit(value)
  }, [onCommit, value])

  const blobSize = compact ? 80 : 120
  const label = MOOD_LABELS[currentMood]
  const bgColor = BLOB_COLORS[currentMood].bg

  return (
    <div className="flex flex-col items-center w-full">
      {/* Blob container with cross-fade */}
      <div
        className="relative mb-4 transition-all duration-500 ease-out rounded-full"
        style={{
          width: blobSize + 40,
          height: blobSize + 40,
          background: `radial-gradient(circle, ${bgColor}18 0%, transparent 70%)`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Outgoing blob (fading out) */}
          {transitioning && prevMood && (
            <div className="absolute animate-mood-fade-out">
              <MoodBlob mood={prevMood} size={blobSize} />
            </div>
          )}
          {/* Current blob (fading in or steady) */}
          <div className={transitioning ? 'animate-mood-fade-in' : ''}>
            <MoodBlob mood={currentMood} size={blobSize} />
          </div>
        </div>
      </div>

      {/* Mood label */}
      <p
        className="text-base font-display font-semibold mb-6 transition-colors duration-300"
        style={{ color: BLOB_COLORS[currentMood].face }}
      >
        {label}
      </p>

      {/* Slider track with gradient */}
      <div className="w-full max-w-xs px-1">
        <div className="relative">
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
            aria-valuetext={label}
          />
        </div>
      </div>

      {/* Anchor labels */}
      <div className="flex justify-between w-full max-w-xs px-1 mt-2">
        <span className="text-xs text-on-surface-variant">Awful</span>
        <span className="text-xs text-on-surface-variant">Great</span>
      </div>
    </div>
  )
}
