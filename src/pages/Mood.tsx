import { useState, useCallback, useMemo } from 'react'
import { MobileMenu } from '@/components/ui/MobileMenu'
import { MoodBlob, moodFromValue, MOOD_VALUES, MOOD_LABELS, type MoodKey } from '@/components/ui/MoodBlob'
import { useMood } from '@/hooks/useMood'

const MOODS: MoodKey[] = ['awful', 'bad', 'meh', 'good', 'great']

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function MoodPage() {
  const { latestMood, history, logMood, logging } = useMood()
  const [selected, setSelected] = useState<MoodKey | null>(null)
  const [note, setNote] = useState('')
  const [justLogged, setJustLogged] = useState(false)

  const currentMoodKey = latestMood ? moodFromValue(latestMood.value) : null

  const handleSelect = useCallback((mood: MoodKey) => {
    setSelected((prev) => (prev === mood ? null : mood))
    setJustLogged(false)
  }, [])

  const handleLog = useCallback(() => {
    if (!selected) return
    logMood(MOOD_VALUES[selected], note.trim() || undefined)
    setJustLogged(true)
    setNote('')
    // Clear selection after a moment
    setTimeout(() => {
      setSelected(null)
      setJustLogged(false)
    }, 2500)
  }, [selected, note, logMood])

  // Group history by day
  const historyByDay = useMemo(() => {
    const groups: { label: string; entries: typeof history }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let currentLabel = ''
    let currentGroup: typeof history = []

    for (const entry of history) {
      const d = new Date(entry.created_at)
      d.setHours(0, 0, 0, 0)
      let label: string
      if (d.getTime() === today.getTime()) label = 'Today'
      else if (d.getTime() === yesterday.getTime()) label = 'Yesterday'
      else label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

      if (label !== currentLabel) {
        if (currentGroup.length > 0) groups.push({ label: currentLabel, entries: currentGroup })
        currentLabel = label
        currentGroup = [entry]
      } else {
        currentGroup.push(entry)
      }
    }
    if (currentGroup.length > 0) groups.push({ label: currentLabel, entries: currentGroup })
    return groups
  }, [history])

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Mood
          </h1>
          <p className="text-on-surface-variant text-sm">
            {latestMood
              ? `Last check-in ${timeAgo(latestMood.created_at)}`
              : 'How are you feeling right now?'}
          </p>
        </div>
        <MobileMenu />
      </div>

      {/* Mood selection — the main event */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 mb-6">
        <p className="text-sm font-medium text-on-surface mb-6 text-center">
          {justLogged ? 'Got it. Take care of yourself.' : 'How are you feeling?'}
        </p>

        {/* Blob grid */}
        <div className="flex justify-center gap-3 md:gap-5 mb-6">
          {MOODS.map((mood) => {
            const isSelected = selected === mood
            const isCurrent = !selected && currentMoodKey === mood
            return (
              <button
                key={mood}
                onClick={() => handleSelect(mood)}
                className={`flex flex-col items-center gap-2 p-2 md:p-3 rounded-2xl transition-all duration-300 cursor-pointer
                  ${isSelected
                    ? 'bg-primary/8 scale-110 ring-2 ring-primary/20'
                    : isCurrent
                      ? 'bg-surface-container-low opacity-80'
                      : 'hover:bg-surface-container-low hover:scale-105 active:scale-95'
                  }
                `}
                aria-label={`${MOOD_LABELS[mood]} mood`}
                aria-pressed={isSelected}
              >
                <div className={`transition-transform duration-300 ${isSelected ? 'animate-mood-bounce' : ''}`}>
                  <MoodBlob mood={mood} size={56} selected={isSelected} />
                </div>
                <span className={`text-xs font-medium transition-colors duration-200 ${
                  isSelected ? 'text-on-surface' : 'text-on-surface-variant'
                }`}>
                  {MOOD_LABELS[mood]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Note input + Log button — appears when mood selected */}
        {selected && !justLogged && (
          <div className="animate-gentle-appear max-w-md mx-auto space-y-3">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLog()}
              placeholder="What's going on? (optional)"
              maxLength={140}
              className="w-full px-4 py-3 text-sm rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
            />
            <button
              onClick={handleLog}
              disabled={logging}
              className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px] disabled:opacity-60"
            >
              {logging ? 'Logging...' : 'Log mood'}
            </button>
          </div>
        )}

        {/* Confirmation */}
        {justLogged && (
          <div className="text-center animate-gentle-appear">
            <div className="inline-flex items-center gap-2 text-primary text-sm font-medium">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 8l3.5 3.5L13 4.5" />
              </svg>
              Logged
            </div>
          </div>
        )}
      </div>

      {/* Mood history */}
      {historyByDay.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-base font-semibold text-on-surface px-1">
            Recent
          </h2>

          {historyByDay.map((group) => (
            <div key={group.label}>
              <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-2 px-1">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.entries.map((entry) => {
                  const mood = moodFromValue(entry.value)
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-lowest"
                    >
                      <MoodBlob mood={mood} size={32} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-on-surface font-medium">
                          {MOOD_LABELS[mood]}
                        </span>
                        {entry.note && (
                          <p className="text-xs text-on-surface-variant truncate">{entry.note}</p>
                        )}
                      </div>
                      <span className="text-xs text-on-surface-variant flex-shrink-0">
                        {formatTime(entry.created_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {historyByDay.length === 0 && !selected && (
        <div className="text-center py-12">
          <div className="flex justify-center gap-2 mb-4 opacity-40">
            {MOODS.map((m) => (
              <MoodBlob key={m} mood={m} size={28} />
            ))}
          </div>
          <p className="text-on-surface-variant text-sm">
            No mood entries yet. Tap a face above to get started.
          </p>
        </div>
      )}
    </div>
  )
}
