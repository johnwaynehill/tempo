import { Link } from 'react-router'
import { useNotes } from '@/hooks/useNotes'

export function NotesPage() {
  const { notes, loading } = useNotes()

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Notes
        </h1>
        <p className="text-on-surface-variant text-sm">
          {notes.length} note{notes.length !== 1 ? 's' : ''}
        </p>
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
                <p className="text-on-surface-variant text-xs">
                  {note.updated_at.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </Link>
            ))}
          </div>

          {notes.length === 0 && (
            <div className="text-center py-20">
              <p className="text-on-surface-variant text-sm">
                No notes yet. Capture one with the + button.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
