import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTodos } from '@/hooks/useTodos'
import { useNotes } from '@/hooks/useNotes'
import { usePreferences } from '@/hooks/usePreferences'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { UserPreferences } from '@/types'

export function SettingsPage() {
  const { user } = useAuth()
  const { todos } = useTodos()
  const { notes } = useNotes()
  const { preferences, updatePreferences } = usePreferences()
  const { canInstall, isInstalled, install } = useInstallPrompt()
  const online = useOnlineStatus()
  const [exporting, setExporting] = useState(false)

  const themeOptions: { value: UserPreferences['theme']; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ]

  const handleExportJSON = async () => {
    setExporting(true)

    const data = {
      exported_at: new Date().toISOString(),
      todos: todos.map((t) => ({
        ...t,
        created_at: t.created_at.toISOString(),
        updated_at: t.updated_at.toISOString(),
        due_date: t.due_date?.toISOString() ?? null,
        defer_until: t.defer_until?.toISOString() ?? null,
        completed_at: t.completed_at?.toISOString() ?? null,
        dismissed_from_today: t.dismissed_from_today?.toISOString() ?? null,
        reminder_at: t.reminder_at?.toISOString() ?? null,
      })),
      notes: notes.map((n) => ({
        ...n,
        created_at: n.created_at.toISOString(),
        updated_at: n.updated_at.toISOString(),
      })),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tempo-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    setExporting(false)
  }

  const handleExportMarkdown = () => {
    // Bundle notes as individual .md files in a zip-like concatenation
    // For simplicity, export as a single combined markdown file
    const lines = notes.map(
      (n) => `# ${n.title}\n\n_Updated: ${n.updated_at.toLocaleDateString()}_\n\n${n.content}\n\n---\n`,
    )
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tempo-notes-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCSV = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      const lines = text.split('\n').filter((l) => l.trim())

      // Skip header row, parse each line as a todo title
      // Simple CSV: assumes first column is the task title
      const rows = lines.slice(1)
      console.log(`Importing ${rows.length} items from CSV...`, rows)

      // TODO: Parse CSV columns and batch create todos
      alert(`Parsed ${rows.length} rows. CSV import mapping coming soon — check console for preview.`)
    }
    input.click()
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Settings
        </h1>
      </div>

      {/* Account */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-on-surface mb-4">Account</h2>
        {user && (
          <div className="flex items-center gap-4 bg-surface-container-lowest rounded-xl p-5">
            <img
              src={user.photoURL ?? ''}
              alt=""
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="text-on-surface text-sm font-medium">{user.displayName}</p>
              <p className="text-on-surface-variant text-xs">{user.email}</p>
            </div>
          </div>
        )}
      </section>

      {/* Data */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-on-surface mb-4">Data</h2>
        <div className="space-y-3">
          <button
            onClick={handleImportCSV}
            className="w-full text-left bg-surface-container-lowest rounded-xl p-5 hover:bg-surface-container-low transition-colors duration-200 cursor-pointer"
          >
            <p className="text-on-surface text-sm font-medium">Import from CSV</p>
            <p className="text-on-surface-variant text-xs mt-0.5">One-time migration from Coda or another tool</p>
          </button>
          <button
            onClick={handleExportJSON}
            disabled={exporting}
            className="w-full text-left bg-surface-container-lowest rounded-xl p-5 hover:bg-surface-container-low transition-colors duration-200 cursor-pointer disabled:opacity-50"
          >
            <p className="text-on-surface text-sm font-medium">
              {exporting ? 'Exporting...' : 'Export all data (JSON)'}
            </p>
            <p className="text-on-surface-variant text-xs mt-0.5">
              {todos.length} todos + {notes.length} notes
            </p>
          </button>
          <button
            onClick={handleExportMarkdown}
            className="w-full text-left bg-surface-container-lowest rounded-xl p-5 hover:bg-surface-container-low transition-colors duration-200 cursor-pointer"
          >
            <p className="text-on-surface text-sm font-medium">Export notes (Markdown)</p>
            <p className="text-on-surface-variant text-xs mt-0.5">
              {notes.length} note{notes.length !== 1 ? 's' : ''} as .md file
            </p>
          </button>
        </div>
      </section>

      {/* Preferences */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-on-surface mb-4">Preferences</h2>
        <div className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface text-sm font-medium">Theme</p>
              <p className="text-on-surface-variant text-xs">Choose your vibe</p>
            </div>
            <div className="flex gap-1.5">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updatePreferences({ theme: opt.value })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                    preferences.theme === opt.value
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface text-sm font-medium">Notifications</p>
              <p className="text-on-surface-variant text-xs">Gentle reminders (Mac only)</p>
            </div>
            <span className="text-xs text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-lg">
              Coming soon
            </span>
          </div>
        </div>
      </section>

      {/* App */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-on-surface mb-4">App</h2>
        <div className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
          {/* Install prompt */}
          {canInstall && (
            <button
              onClick={install}
              className="w-full text-left flex items-center justify-between cursor-pointer"
            >
              <div>
                <p className="text-on-surface text-sm font-medium">Install Tempo</p>
                <p className="text-on-surface-variant text-xs">Add to your home screen for quick access</p>
              </div>
              <span className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-medium">
                Install
              </span>
            </button>
          )}

          {/* Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface text-sm font-medium">Status</p>
              <p className="text-on-surface-variant text-xs">
                {isInstalled ? 'Installed as PWA' : 'Running in browser'}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              online ? 'text-primary' : 'text-on-surface-variant'
            }`}>
              <span className={`w-2 h-2 rounded-full ${online ? 'bg-primary' : 'bg-outline-variant'}`} />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Version */}
          <div className="flex items-center justify-between">
            <p className="text-on-surface-variant text-xs">Version</p>
            <p className="text-on-surface-variant text-xs font-mono">0.8.0</p>
          </div>
        </div>
      </section>
    </div>
  )
}
