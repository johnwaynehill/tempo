import { useParams, Link, useNavigate } from 'react-router'
import { useRef, useCallback } from 'react'
import { useNotes } from '@/hooks/useNotes'
import { useTodos } from '@/hooks/useTodos'
import { MilkdownEditor } from '@/components/ui/MilkdownEditor'

export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notes, loading, updateNote, removeNote } = useNotes()
  const { todos } = useTodos()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const note = notes.find((n) => n.id === id)
  const linkedTodo = note?.linked_todo_id
    ? todos.find((t) => t.id === note.linked_todo_id)
    : undefined

  // Debounced auto-save (800ms after last keystroke)
  const handleContentChange = useCallback(
    (markdown: string) => {
      if (!id) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        updateNote(id, { content: markdown })
      }, 800)
    },
    [id, updateNote],
  )

  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!id) return
    const newTitle = e.target.value.trim()
    if (newTitle && newTitle !== note?.title) {
      updateNote(id, { title: newTitle })
    }
  }

  const handleDelete = async () => {
    if (!id) return
    await removeNote(id)
    navigate('/notes')
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-on-surface-variant text-sm">Loading...</p>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="py-20 text-center">
        <p className="text-on-surface-variant text-sm mb-4">Note not found.</p>
        <Link to="/notes" className="text-primary text-sm hover:underline">
          Back to Notes
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Nav */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/notes"
          className="text-on-surface-variant text-sm hover:text-on-surface transition-colors duration-200"
        >
          &larr; Notes
        </Link>
        <button
          onClick={handleDelete}
          className="text-xs text-error/70 hover:text-error px-3 py-1.5 rounded-lg hover:bg-error/5 transition-colors duration-200 cursor-pointer"
        >
          Delete
        </button>
      </div>

      {/* Title */}
      <input
        type="text"
        defaultValue={note.title}
        onBlur={handleTitleBlur}
        className="w-full font-display text-2xl md:text-3xl font-bold text-on-surface tracking-tight outline-none bg-transparent mb-2 placeholder:text-on-surface-variant/30"
        placeholder="Untitled"
      />

      {/* Metadata */}
      <p className="text-on-surface-variant text-xs mb-4">
        Last edited{' '}
        {note.updated_at.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </p>

      {/* Linked todo chip */}
      {linkedTodo && (
        <div className="mb-6 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            linkedTodo.status === 'done'
              ? 'bg-primary/10 text-primary line-through'
              : 'bg-surface-container-high text-on-surface-variant'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              linkedTodo.status === 'done' ? 'bg-primary' : 'border border-outline-variant'
            }`} />
            {linkedTodo.title}
          </span>
        </div>
      )}

      {/* Editor */}
      <MilkdownEditor
        defaultValue={note.content}
        onChange={handleContentChange}
      />
    </div>
  )
}
