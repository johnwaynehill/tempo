import { useParams, Link } from 'react-router'

export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()

  // TODO: Fetch note from Firestore by id
  // TODO: Initialize Milkdown editor with note content

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/notes"
          className="text-on-surface-variant text-sm hover:text-on-surface transition-colors duration-200"
        >
          &larr; Notes
        </Link>
      </div>

      {/* Milkdown editor will mount here */}
      <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 min-h-[60vh]">
        <h2 className="font-display text-xl font-semibold text-on-surface mb-4">
          Note Editor
        </h2>
        <p className="text-on-surface-variant text-sm">
          Milkdown WYSIWYG editor will be integrated here for note <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{id}</code>
        </p>
      </div>
    </div>
  )
}
