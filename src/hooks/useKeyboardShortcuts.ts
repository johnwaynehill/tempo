import { useEffect } from 'react'

export interface Shortcut {
  /** Display label, e.g. "⌘ K" */
  label: string
  /** Description for the help sheet */
  description: string
  /** Key to match (e.g. 'k', 'n', '1') */
  key: string
  /** Require Cmd (Mac) / Ctrl (Windows) */
  meta?: boolean
  /** Require Shift */
  shift?: boolean
  /** Handler */
  action: () => void
}

/**
 * Returns true if the event target is an editable element
 * where we should NOT intercept shortcuts.
 */
function isEditing(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((e.target as HTMLElement)?.isContentEditable) return true
  return false
}

/**
 * Register global keyboard shortcuts. Shortcuts are suppressed
 * when the user is typing in an input/textarea/contenteditable.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in form fields
      if (isEditing(e)) return

      for (const s of shortcuts) {
        const metaMatch = s.meta ? (e.metaKey || e.ctrlKey) : (!e.metaKey && !e.ctrlKey)
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase()

        if (metaMatch && shiftMatch && keyMatch) {
          e.preventDefault()
          s.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}

/** All app shortcuts (static labels/descriptions for the help sheet). */
export const SHORTCUT_MAP = {
  capture:    { label: 'C', description: 'Quick capture (new todo/note)' },
  today:      { label: '1', description: 'Go to Today' },
  inbox:      { label: '2', description: 'Go to Inbox' },
  backlog:    { label: '3', description: 'Go to Backlog' },
  notes:      { label: '4', description: 'Go to Notes' },
  braindump:  { label: '5', description: 'Go to Brain Dump' },
  settings:   { label: ',', description: 'Go to Settings' },
  focus:      { label: 'F', description: 'Focus mode' },
  help:       { label: '?', description: 'Show keyboard shortcuts' },
  search:     { label: '/', description: 'Focus search (on current page)' },
} as const
