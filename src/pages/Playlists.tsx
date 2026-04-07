import { useState } from 'react'
import { useNavigate } from 'react-router'
import { usePlaylists } from '@/hooks/usePlaylists'
import { MobileMenu } from '@/components/ui/MobileMenu'
import { formatMinutes } from '@/hooks/useTimer'

export function PlaylistsPage() {
  const navigate = useNavigate()
  const { playlists, loading, addPlaylist, startPlaylist } = usePlaylists()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [starting, setStarting] = useState<string | null>(null)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const id = await addPlaylist({ name })
    setNewName('')
    setShowCreate(false)
    navigate(`/playlists/${id}`)
  }

  const handleStart = async (id: string) => {
    setStarting(id)
    await startPlaylist(id)
    setStarting(null)
    navigate('/today')
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Playlists
          </h1>
          <p className="text-on-surface-variant text-sm">
            Routine task sequences you can start with one tap
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px]"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New
          </button>
          <MobileMenu />
        </div>
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : playlists.length === 0 ? (
        <div className="text-center py-20 animate-gentle-appear">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          </div>
          <p className="text-on-surface font-display font-semibold text-base mb-1">
            No playlists yet
          </p>
          <p className="text-on-surface-variant text-sm max-w-xs mx-auto">
            Create a routine to breeze through repetitive task sequences.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {playlists.map((playlist) => {
            const totalMinutes = playlist.items.reduce((sum, item) => sum + (item.estimated_minutes ?? 15), 0)
            return (
              <div
                key={playlist.id}
                className="bg-surface-container-lowest rounded-xl p-5 flex items-center gap-4"
              >
                <button
                  onClick={() => navigate(`/playlists/${playlist.id}`)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <p className="text-on-surface text-sm font-medium">{playlist.name}</p>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    {playlist.items.length} task{playlist.items.length !== 1 ? 's' : ''} &middot; {formatMinutes(totalMinutes)}
                  </p>
                </button>
                <button
                  onClick={() => handleStart(playlist.id)}
                  disabled={starting === playlist.id || playlist.items.length === 0}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-medium hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px] disabled:opacity-50"
                >
                  {starting === playlist.id ? 'Starting...' : 'Start'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowCreate(false)}
        >
          <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />
          <div
            className="relative bg-surface-container-lowest rounded-2xl shadow-xl p-6 w-[90vw] max-w-sm animate-gentle-appear"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-on-surface mb-4">New playlist</h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g., Morning routine"
              className="w-full bg-surface-container rounded-lg px-4 py-3 text-on-surface text-sm outline-none placeholder:text-on-surface-variant/40 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-xl text-on-surface-variant text-sm font-medium hover:text-on-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
