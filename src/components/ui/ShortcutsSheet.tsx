import { useEffect } from 'react'

interface ShortcutsSheetProps {
  onClose: () => void
}

const sections = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['1'], description: 'Today' },
      { keys: ['2'], description: 'Inbox' },
      { keys: ['3'], description: 'Backlog' },
      { keys: ['4'], description: 'Notes' },
      { keys: ['5'], description: 'Brain Dump' },
      { keys: ['6'], description: 'Habits' },
      { keys: ['7'], description: 'Insights' },
      { keys: ['8'], description: 'Review' },
      { keys: [','], description: 'Settings' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['C'], description: 'Quick capture' },
      { keys: ['N'], description: 'New note' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show this sheet' },
      { keys: ['Esc'], description: 'Close modal / go back' },
    ],
  },
]

export function ShortcutsSheet({ onClose }: ShortcutsSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-on-surface">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface text-xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-on-surface-variant text-xs font-medium uppercase tracking-wider mb-2">
                {section.title}
              </p>
              <div className="space-y-1.5">
                {section.shortcuts.map((s) => (
                  <div
                    key={s.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-on-surface text-sm">{s.description}</span>
                    <div className="flex gap-1">
                      {s.keys.map((key) => (
                        <kbd
                          key={key}
                          className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-lg bg-surface-container text-on-surface-variant text-xs font-mono font-medium border border-outline-variant/20"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-on-surface-variant/50 text-xs text-center mt-6">
          Press <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-xs font-mono">?</kbd> anytime to see this sheet
        </p>
      </div>
    </div>
  )
}
