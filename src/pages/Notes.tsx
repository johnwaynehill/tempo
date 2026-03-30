import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useNotes } from '@/hooks/useNotes'

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
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-medium hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          New note
        </button>
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
