import { Link } from 'react-router'
import type { Note } from '@/types'

// Placeholder — will be replaced with Firestore query
const MOCK_NOTES: Note[] = [
  {
    id: 'n1',
    title: 'Tempo architecture decisions',
    content: '# Architecture\n\nVite + React, Firebase, Milkdown...',
    created_at: new Date(Date.now() - 2 * 86400000),
    updated_at: new Date(),
  },
  {
    id: 'n2',
    title: 'Railway vs Vercel comparison',
    content: '# Hosting\n\nRailway consolidates with GatherBound...',
    created_at: new Date(Date.now() - 86400000),
    updated_at: new Date(),
  },
]

export function NotesPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Notes
        </h1>
        <p className="text-on-surface-variant text-sm">
          {MOCK_NOTES.length} note{MOCK_NOTES.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-3">
        {MOCK_NOTES.map((note) => (
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

      {MOCK_NOTES.length === 0 && (
        <div className="text-center py-20">
          <p className="text-on-surface-variant text-sm">
            No notes yet. Capture one with the + button.
          </p>
        </div>
      )}
    </div>
  )
}
