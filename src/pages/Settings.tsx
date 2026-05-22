import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { useTodos } from '@/hooks/useTodos'
import { useNotes } from '@/hooks/useNotes'
import { usePreferences } from '@/hooks/usePreferences'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useNotifications } from '@/hooks/useNotifications'
import { CodaImportModal } from '@/components/ui/CodaImportModal'
import { MenuButton } from '@/components/ui/MenuButton'
import type { UserPreferences } from '@/types'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { todos } = useTodos()
  const { notes } = useNotes()
  const { preferences, updatePreferences } = usePreferences()
  const { canInstall, isInstalled, install } = useInstallPrompt()
  const online = useOnlineStatus()
  const { permission, isSupported, isGranted, requestPermission } = useNotifications()
  const [exporting, setExporting] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'updating'>('idle')
  type ApiKeyRow = { id: string; keyPrefix: string; name: string; scopes: string[]; createdAt: string; lastUsedAt: string | null }
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  // Default new keys to read-only — least privilege. Users opt into write/ai.
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read'])
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showApiKeys, setShowApiKeys] = useState(false)
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyRow | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const loadApiKeys = useCallback(async () => {
    setApiKeysLoading(true)
    try {
      const keys = await api.apiKeys.list() as typeof apiKeys
      setApiKeys(keys)
    } catch { /* ignore */ }
    setApiKeysLoading(false)
  }, [])

  useEffect(() => {
    if (showApiKeys && apiKeys.length === 0) loadApiKeys()
  }, [showApiKeys, loadApiKeys])

  const handleCreateApiKey = async () => {
    const name = newKeyName.trim() || 'Default'
    const scopes = newKeyScopes.length > 0 ? newKeyScopes : ['read']
    const result = await api.apiKeys.create(name, scopes) as { key: string }
    setCreatedKey(result.key)
    setNewKeyName('')
    setNewKeyScopes(['read'])
    setCopiedKey(null)
    await loadApiKeys()
  }

  const toggleNewKeyScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  const handleConfirmRevoke = async () => {
    if (!keyToRevoke) return
    const id = keyToRevoke.id
    setRevokingId(id)
    setRevokeError(null)
    try {
      await api.apiKeys.delete(id)
      setKeyToRevoke(null)
      await loadApiKeys()
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to revoke key')
    } finally {
      setRevokingId(null)
    }
  }

  const handleCopyKey = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedKey(label)
    setTimeout(() => setCopiedKey(null), 3000)
  }

  const handleCheckForUpdates = useCallback(async () => {
    setUpdateStatus('checking')
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      if (registration) {
        await registration.update()
        // Check if a new worker is waiting
        if (registration.waiting) {
          setUpdateStatus('updating')
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          window.location.reload()
        } else {
          setUpdateStatus('up-to-date')
          setTimeout(() => setUpdateStatus('idle'), 3000)
        }
      } else {
        setUpdateStatus('up-to-date')
        setTimeout(() => setUpdateStatus('idle'), 3000)
      }
    } catch {
      setUpdateStatus('up-to-date')
      setTimeout(() => setUpdateStatus('idle'), 3000)
    }
  }, [])

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

  const handleImportCSV = () => setShowImportModal(true)

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Settings
        </h1>
        <MenuButton />
      </div>

      {/* Account */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-on-surface mb-4">Account</h2>
        {user && (
          <div className="flex items-center justify-between bg-surface-container-lowest rounded-xl p-5">
            <div className="flex items-center gap-4">
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
            <button
              onClick={signOut}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer"
            >
              Log out
            </button>
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
              <p className="text-on-surface text-sm font-medium">Adaptive theme</p>
              <p className="text-on-surface-variant text-xs">Adjust colors based on your energy level</p>
            </div>
            <button
              onClick={() => updatePreferences({ adaptive_theme: !preferences.adaptive_theme })}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                preferences.adaptive_theme
                  ? 'bg-primary'
                  : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface-container-lowest shadow transition-transform duration-200 ${
                  preferences.adaptive_theme
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface text-sm font-medium">Notifications</p>
              <p className="text-on-surface-variant text-xs">
                {!isSupported
                  ? 'Not supported in this browser'
                  : permission === 'denied'
                    ? 'Blocked by browser — enable in system settings'
                    : 'Gentle reminders (Mac only)'}
              </p>
            </div>
            {isSupported && permission !== 'denied' ? (
              <button
                onClick={async () => {
                  if (!isGranted) {
                    const result = await requestPermission()
                    if (result === 'granted') {
                      updatePreferences({ notifications_enabled: true })
                    }
                  } else {
                    updatePreferences({
                      notifications_enabled: !preferences.notifications_enabled,
                    })
                  }
                }}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                  preferences.notifications_enabled && isGranted
                    ? 'bg-primary'
                    : 'bg-surface-container-high'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface-container-lowest shadow transition-transform duration-200 ${
                    preferences.notifications_enabled && isGranted
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            ) : (
              <span className="text-xs text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-lg">
                Unavailable
              </span>
            )}
          </div>
          {/* Morning auto-plan */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface text-sm font-medium">Morning auto-plan</p>
              <p className="text-on-surface-variant text-xs">
                Let Tempo AI pre-fill Today with 3–5 tasks each morning. Replaces whatever's in Today.
              </p>
            </div>
            <button
              onClick={() => updatePreferences({ autoplan_enabled: !preferences.autoplan_enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                preferences.autoplan_enabled
                  ? 'bg-primary'
                  : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface-container-lowest shadow transition-transform duration-200 ${
                  preferences.autoplan_enabled
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {preferences.autoplan_enabled && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-on-surface text-sm font-medium">Timezone</p>
                <p className="text-on-surface-variant text-xs">
                  Used to decide when "today" starts. IANA format (e.g. America/Los_Angeles).
                </p>
              </div>
              <input
                type="text"
                value={preferences.autoplan_timezone}
                onChange={(e) => updatePreferences({ autoplan_timezone: e.target.value })}
                placeholder="America/Los_Angeles"
                spellCheck={false}
                className="bg-surface-container rounded-lg px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none w-52 text-right font-mono"
              />
            </div>
          )}
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

          {/* Check for updates */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface text-sm font-medium">Check for updates</p>
              <p className="text-on-surface-variant text-xs">
                {updateStatus === 'checking'
                  ? 'Checking...'
                  : updateStatus === 'up-to-date'
                    ? 'You\'re on the latest version'
                    : updateStatus === 'updating'
                      ? 'Updating...'
                      : 'Manually check for a new version'}
              </p>
            </div>
            <button
              onClick={handleCheckForUpdates}
              disabled={updateStatus !== 'idle'}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer disabled:opacity-50 ${
                updateStatus === 'up-to-date'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-primary text-on-primary hover:shadow-md'
              }`}
            >
              {updateStatus === 'checking'
                ? 'Checking...'
                : updateStatus === 'up-to-date'
                  ? 'Up to date'
                  : updateStatus === 'updating'
                    ? 'Updating...'
                    : 'Update'}
            </button>
          </div>

          {/* Design system */}
          <a
            href="/design-system.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="text-on-surface text-sm font-medium">Design system</p>
              <p className="text-on-surface-variant text-xs">A visual tour of the "Quiet Rhythm"</p>
            </div>
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-container-high text-on-surface-variant">
              Open ↗
            </span>
          </a>
        </div>
      </section>

      {/* API Keys */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-on-surface mb-4">API Keys</h2>
        <div className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface text-sm font-medium">Manage API keys</p>
              <p className="text-on-surface-variant text-xs">Used by Claude Code and other MCP clients</p>
            </div>
            <button
              onClick={() => setShowApiKeys(!showApiKeys)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors duration-200 cursor-pointer"
            >
              {showApiKeys ? 'Hide' : 'Show'}
            </button>
          </div>

          {showApiKeys && (
            <>
              {/* Create new key */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g. Work laptop)"
                    className="flex-1 bg-surface-container rounded-lg px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateApiKey()}
                  />
                  <button
                    onClick={handleCreateApiKey}
                    disabled={newKeyScopes.length === 0}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-on-primary hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                </div>
                {/* Scope picker */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-on-surface-variant text-xs mr-1">Scopes:</span>
                  {([
                    { id: 'read', label: 'Read', help: 'GET on all resources' },
                    { id: 'write', label: 'Write', help: 'Create / update / delete (implies read)' },
                    { id: 'ai', label: 'AI', help: 'Tempo AI proxy — costs money per call' },
                  ] as const).map((scope) => {
                    const selected = newKeyScopes.includes(scope.id)
                    return (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => toggleNewKeyScope(scope.id)}
                        title={scope.help}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer ${
                          selected
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {scope.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Newly created key (show once) */}
              {createdKey && (
                <div className="bg-primary/10 rounded-lg p-4 space-y-3">
                  <p className="text-on-surface text-xs font-medium">New API key created — copy it now, it won't be shown again:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono text-on-surface bg-surface-container rounded px-2 py-1.5 select-all break-all">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => handleCopyKey(createdKey, 'key')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-on-primary hover:shadow-md transition-all duration-200 cursor-pointer shrink-0"
                    >
                      {copiedKey === 'key' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* MCP config snippet */}
                  <div className="border-t border-outline-variant/30 pt-3">
                    <p className="text-on-surface text-xs font-medium mb-1.5">Add to your MCP config:</p>
                    <div className="relative">
                      <pre className="text-xs font-mono text-on-surface bg-surface-container rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre">
{`"tempo-mcp": {
  "type": "url",
  "url": "https://tempo-mcp-production.up.railway.app/mcp",
  "headers": {
    "X-API-Key": "${createdKey}"
  }
}`}
                      </pre>
                      <button
                        onClick={() => handleCopyKey(JSON.stringify({
                          "tempo-mcp": {
                            type: "url",
                            url: "https://tempo-mcp-production.up.railway.app/mcp",
                            headers: { "X-API-Key": createdKey }
                          }
                        }, null, 2), 'config')}
                        className="absolute top-1.5 right-1.5 px-2 py-1 rounded text-xs font-medium bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors duration-200 cursor-pointer"
                      >
                        {copiedKey === 'config' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setCreatedKey(null)}
                    className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Existing keys */}
              {apiKeysLoading ? (
                <p className="text-on-surface-variant text-xs">Loading...</p>
              ) : apiKeys.length === 0 ? (
                <p className="text-on-surface-variant text-xs">No API keys yet</p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((k) => {
                    const isLegacy = k.scopes?.includes('legacy')
                    return (
                      <div key={k.id} className="flex items-center justify-between bg-surface-container rounded-lg px-3 py-2 gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-on-surface text-sm font-medium">{k.name}</p>
                            {(k.scopes ?? []).map((s) => (
                              <span
                                key={s}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                                  s === 'legacy'
                                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                    : s === 'ai'
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                      : s === 'write'
                                        ? 'bg-primary/15 text-primary'
                                        : 'bg-surface-container-high text-on-surface-variant'
                                }`}
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                          <p className="text-on-surface-variant text-xs font-mono mt-0.5">{k.keyPrefix}</p>
                          <p className="text-on-surface-variant text-xs mt-0.5">
                            {k.lastUsedAt
                              ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                              : 'Never used'}
                            {isLegacy && ' · Full access — rotate when convenient'}
                          </p>
                        </div>
                        <button
                          onClick={() => { setRevokeError(null); setKeyToRevoke(k) }}
                          disabled={revokingId === k.id}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {revokingId === k.id ? 'Revoking…' : 'Revoke'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {showImportModal && (
        <CodaImportModal onClose={() => setShowImportModal(false)} />
      )}

      {/* Revoke API key confirmation */}
      {keyToRevoke && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={() => revokingId === null && setKeyToRevoke(null)}
        >
          <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />
          <div
            className="relative bg-surface-container-lowest rounded-2xl shadow-xl p-6 mx-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-on-surface mb-2">
              Revoke API key?
            </h2>
            <p className="text-on-surface-variant text-sm mb-2">
              <span className="font-medium text-on-surface">{keyToRevoke.name}</span>{' '}
              <span className="font-mono text-xs">({keyToRevoke.keyPrefix})</span>
            </p>
            <p className="text-on-surface-variant text-sm mb-1">
              {keyToRevoke.lastUsedAt
                ? `Last used ${new Date(keyToRevoke.lastUsedAt).toLocaleDateString()}.`
                : 'Never used.'}
            </p>
            <p className="text-on-surface-variant text-sm mb-6">
              Any agent or script using this key will start getting <code className="font-mono text-xs">401 Unauthorized</code> immediately. This can&rsquo;t be undone — you&rsquo;ll need to issue a new key and update the consumer.
            </p>
            {revokeError && (
              <p className="text-red-500 text-xs mb-4">{revokeError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setKeyToRevoke(null)}
                disabled={revokingId !== null}
                className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={revokingId !== null}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-error text-on-primary hover:bg-error/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {revokingId !== null ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
