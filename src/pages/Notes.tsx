import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useNotes } from '@/hooks/useNotes'
import { MenuButton } from '@/components/ui/MenuButton'

export function NotesPage() {
  const { notes, addNote, loading } = useNotes()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (creating) return
    setCreating(true)
    try {
      const id = await addNote('Untitled')
      navigate(`/notes/${id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Notes
          </h1>
          <p className="text-on-surface-variant text-sm">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
            aria-label="New note"
            title="New note (N)"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <MenuButton />
        </div>
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : (
        <>
          <div className="space-y-3">
            {notes.map((note) => (
              <Link
                key={note.id}
                to={`/notes/${note.id}`}
                className="block bg-surface-container-lowest rounded-xl p-5 hover:bg-surface-container-low transition-colors duration-200"
              >
                <h3 className="font-display font-semibold text-on-surface text-[15px] mb-1">
                  {note.title}
                </h3>
                <div className="flex items-center gap-2">
                  <p className="text-on-surface-variant text-xs">
                    {note.updated_at.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  {note.linked_todo_id && (
                    <span className="text-xs text-primary/60">linked</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {notes.length === 0 && (
            <div className="text-center py-20">
              <p className="text-on-surface-variant text-sm">
                No notes yet. Create one above or capture with the + button.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
