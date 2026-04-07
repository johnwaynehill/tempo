import { useState, useCallback, useEffect } from 'react'
import { MoodSlider } from './MoodSlider'
import { ENERGY_LEVELS, ENERGY_LABELS, type EnergyLevel, type MoodEntry } from '@/types'

interface CheckInWidgetProps {
  energy?: EnergyLevel | null
  onEnergyChange: (level: EnergyLevel | null) => void
  latestMood: MoodEntry | null
  onMoodCommit: (value: number, note?: string) => void
}

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function CheckInWidget({ energy, onEnergyChange, latestMood, onMoodCommit }: CheckInWidgetProps) {
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [lastCommittedValue, setLastCommittedValue] = useState<number | null>(null)

  // Auto-hide note input after 5 seconds
  useEffect(() => {
    if (!showNote) return
    const timer = setTimeout(() => setShowNote(false), 5000)
    return () => clearTimeout(timer)
  }, [showNote])

  const handleMoodCommit = useCallback((value: number) => {
    setLastCommittedValue(value)
    setShowNote(true)
    setNote('')
    onMoodCommit(value)
  }, [onMoodCommit])

  const handleNoteSubmit = useCallback(() => {
    if (note.trim() && lastCommittedValue !== null) {
      onMoodCommit(lastCommittedValue, note.trim())
    }
    setShowNote(false)
    setNote('')
  }, [note, lastCommittedValue, onMoodCommit])

  return (
    <div className="space-y-4">
      {/* Mood slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-on-surface-variant font-medium">How are you feeling?</span>
          {latestMood && (
            <span className="text-xs text-on-surface-variant opacity-60">
              {timeAgo(latestMood.created_at)}
            </span>
          )}
        </div>
        <MoodSlider
          initialValue={latestMood?.value ?? 50}
          onCommit={handleMoodCommit}
        />
      </div>

      {/* Optional note input (appears after mood commit) */}
      {showNote && (
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNoteSubmit()}
            onBlur={() => setTimeout(() => setShowNote(false), 200)}
            placeholder="What's on your mind? (optional)"
            maxLength={140}
            autoFocus
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      )}

      {/* Energy selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-on-surface-variant font-medium mr-1">Energy</span>
        {ENERGY_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => onEnergyChange(energy === level ? null : level)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer min-h-[36px] ${
              energy === level
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {ENERGY_LABELS[level]}
          </button>
        ))}
      </div>
    </div>
  )
}
