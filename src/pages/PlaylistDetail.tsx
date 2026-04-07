import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { usePlaylists } from '@/hooks/usePlaylists'
import { formatMinutes } from '@/hooks/useTimer'
import type { PlaylistItem } from '@/types'

type ItemDraft = Omit<PlaylistItem, 'id' | 'playlist_id'>

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { playlists, loading, updatePlaylist, deletePlaylist, startPlaylist } = usePlaylists()

  const playlist = playlists.find((p) => p.id === id)

  const [name, setName] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)

  // Sync from playlist data
  useEffect(() => {
    if (playlist && !dirty) {
      setName(playlist.name)
      setItems(
        playlist.items.map((item) => ({
          title: item.title,
          sort_order: item.sort_order,
          size: item.size,
          energy_level: item.energy_level,
          estimated_minutes: item.estimated_minutes,
          project: item.project,
        })),
      )
    }
  }, [playlist, dirty])

  const handleSave = async () => {
    if (!id || !name.trim()) return
    setSaving(true)
    await updatePlaylist(id, {
      name: name.trim(),
      items: items.map((item, i) => ({ ...item, sort_order: i })),
    } as any)
    setDirty(false)
    setSaving(false)
  }

  const handleAddItem = () => {
    const title = newTitle.trim()
    if (!title) return
    setItems([...items, { title, sort_order: items.length, estimated_minutes: 15 }])
    setNewTitle('')
    setDirty(true)
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
    setDirty(true)
  }

  const handleMoveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    setItems(next)
    setDirty(true)
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('Delete this playlist?')) return
    await deletePlaylist(id)
    navigate('/playlists')
  }

  const handleStart = async () => {
    if (!id) return
    setStarting(true)
    await startPlaylist(id)
    navigate('/today')
  }

  if (loading) {
    return <p className="text-on-surface-variant text-sm py-8">Loading...</p>
  }

  if (!playlist) {
    return <p className="text-on-surface-variant text-sm py-8">Playlist not found.</p>
  }

  const totalMinutes = items.reduce((sum, item) => sum + (item.estimated_minutes ?? 15), 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate('/playlists')}
            className="text-on-surface-variant text-xs hover:text-on-surface transition-colors cursor-pointer mb-2 flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 2L4 7l5 5" />
            </svg>
            Playlists
          </button>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true) }}
            className="w-full bg-transparent font-display text-2xl md:text-3xl font-bold text-on-surface tracking-tight outline-none"
            placeholder="Playlist name"
          />
          <p className="text-on-surface-variant text-sm mt-1">
            {items.length} task{items.length !== 1 ? 's' : ''} &middot; {formatMinutes(totalMinutes)}
          </p>
        </div>
        <button
          onClick={handleStart}
          disabled={starting || items.length === 0}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px] disabled:opacity-50 shrink-0"
        >
          {starting ? 'Starting...' : 'Start'}
        </button>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-6">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-lowest group"
          >
            <span className="text-xs text-on-surface-variant/40 w-5 text-center shrink-0">
              {index + 1}
            </span>
            <p className="text-sm text-on-surface flex-1 min-w-0 truncate">{item.title}</p>
            {item.estimated_minutes && (
              <span className="text-xs text-on-surface-variant shrink-0">
                {formatMinutes(item.estimated_minutes)}
              </span>
            )}
            {/* Reorder + delete */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleMoveItem(index, -1)}
                disabled={index === 0}
                className="p-1 rounded text-on-surface-variant/50 hover:text-on-surface disabled:opacity-20 cursor-pointer"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 8l4-4 4 4" />
                </svg>
              </button>
              <button
                onClick={() => handleMoveItem(index, 1)}
                disabled={index === items.length - 1}
                className="p-1 rounded text-on-surface-variant/50 hover:text-on-surface disabled:opacity-20 cursor-pointer"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 4l4 4 4-4" />
                </svg>
              </button>
              <button
                onClick={() => handleRemoveItem(index)}
                className="p-1 rounded text-on-surface-variant/50 hover:text-error cursor-pointer"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add item */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleAddItem() }}
        className="flex items-center gap-2 mb-8"
      >
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a step..."
          className="flex-1 bg-surface-container rounded-lg px-4 py-3 text-on-surface text-sm outline-none placeholder:text-on-surface-variant/40"
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className="px-4 py-3 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer disabled:opacity-30"
        >
          Add
        </button>
      </form>

      {/* Save + Delete */}
      <div className="flex items-center gap-3 border-t border-outline-variant/15 pt-6">
        <button
          onClick={handleDelete}
          className="text-sm text-error/70 hover:text-error transition-colors cursor-pointer"
        >
          Delete playlist
        </button>
        <div className="flex-1" />
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        )}
      </div>
    </div>
  )
}
