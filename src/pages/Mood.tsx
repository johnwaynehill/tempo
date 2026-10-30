import { useState, useCallback, useMemo } from 'react'
import { MoodSlider } from '@/components/ui/MoodSlider'
import { MoodBlob } from '@/components/ui/MoodBlob'
import { moodFromValue, MOOD_LABELS } from '@/lib/mood'
import { useMood } from '@/hooks/useMood'
import { MenuButton } from '@/components/ui/MenuButton'

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
  const { latestMood, history, logMood, deleteMood, logging } = useMood()
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [justLogged, setJustLogged] = useState(false)
  const [lastValue, setLastValue] = useState<number | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const handleMoodCommit = useCallback((value: number) => {
    setLastValue(value)
    setShowNote(true)
    setJustLogged(false)
  }, [])

  const handleLog = useCallback(() => {
    if (lastValue === null) return
    logMood(lastValue, note.trim() || undefined)
    setJustLogged(true)
    setShowNote(false)
    setNote('')
    setTimeout(() => setJustLogged(false), 2500)
  }, [lastValue, note, logMood])

  const handleSkipNote = useCallback(() => {
    if (lastValue === null) return
    logMood(lastValue)
    setJustLogged(true)
    setShowNote(false)
    setNote('')
    setTimeout(() => setJustLogged(false), 2500)
  }, [lastValue, logMood])

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
        <MenuButton />
      </div>

      {/* Mood slider — the main event */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 mb-6">
        {!justLogged && !showNote && (
          <p className="text-sm font-medium text-on-surface mb-4 text-center">
            How are you feeling?
          </p>
        )}

        {/* Slider with animated blob */}
        {!showNote && !justLogged && (
          <MoodSlider
            initialValue={latestMood?.value ?? 50}
            onCommit={handleMoodCommit}
          />
        )}

        {/* Note input + action buttons — after slider commit */}
        {showNote && !justLogged && (
          <div className="animate-gentle-appear max-w-sm mx-auto space-y-3">
            <p className="text-sm font-medium text-on-surface text-center mb-4">
              {lastValue !== null ? MOOD_LABELS[moodFromValue(lastValue)] : ''} — want to add a note?
            </p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLog()}
              placeholder="What's going on? (optional)"
              maxLength={140}
              autoFocus
              className="w-full px-4 py-3 text-sm rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSkipNote}
                disabled={logging}
                className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface-variant text-sm font-medium hover:bg-surface-container-high transition-colors cursor-pointer min-h-[44px]"
              >
                Skip
              </button>
              <button
                onClick={handleLog}
                disabled={logging}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px] disabled:opacity-60"
              >
                {logging ? 'Logging...' : 'Log mood'}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation */}
        {justLogged && (
          <div className="text-center animate-gentle-appear py-8">
            {lastValue !== null && (
              <div className="flex justify-center mb-4">
                <MoodBlob mood={moodFromValue(lastValue)} size={64} />
              </div>
            )}
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
                      className="group flex items-center gap-3 pl-4 pr-1 py-1.5 rounded-xl bg-surface-container-lowest"
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
                      <button
                        onClick={() => setConfirmingDelete(entry.id)}
                        className="w-11 h-11 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error hover:bg-error/5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-60 transition-all duration-200 cursor-pointer flex-shrink-0"
                        aria-label={`Delete ${MOOD_LABELS[mood]} check-in from ${formatTime(entry.created_at)}`}
                        title="Delete check-in"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={() => setConfirmingDelete(null)}
        >
          <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />
          <div
            className="relative bg-surface-container-lowest rounded-2xl shadow-xl p-6 mx-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-on-surface mb-2">
              Delete this check-in?
            </h2>
            <p className="text-on-surface-variant text-sm mb-6">
              This can&rsquo;t be undone. A habit it checked off stays checked.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmingDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMood(confirmingDelete)
                  setConfirmingDelete(null)
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-error text-on-primary hover:bg-error/90 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {historyByDay.length === 0 && !showNote && !justLogged && (
        <div className="text-center py-12">
          <p className="text-on-surface-variant text-sm">
            No mood entries yet. Drag the slider and release to log your first mood.
          </p>
        </div>
      )}
    </div>
  )
}
