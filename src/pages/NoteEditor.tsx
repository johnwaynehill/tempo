import { useParams, Link, useNavigate } from 'react-router'
import { useRef, useCallback, useState, useEffect } from 'react'
import { useNotes } from '@/hooks/useNotes'
import { useTodos } from '@/hooks/useTodos'
import { MilkdownEditor } from '@/components/ui/MilkdownEditor'
import { LinkPicker } from '@/components/ui/LinkPicker'

export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notes, loading, updateNote, removeNote } = useNotes()
  const { todos, updateTodo, addTodo } = useTodos()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const [showTodoPicker, setShowTodoPicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)

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

  const handleDeleteClick = () => setShowDeleteConfirm(true)

  const confirmDelete = async () => {
    if (!id) return
    await removeNote(id)
    navigate('/notes')
  }

  const closeConfirm = () => {
    setConfirmVisible(false)
    setTimeout(() => setShowDeleteConfirm(false), 200)
  }

  useEffect(() => {
    if (showDeleteConfirm) {
      requestAnimationFrame(() => setConfirmVisible(true))
    }
  }, [showDeleteConfirm])

  useEffect(() => {
    if (!showDeleteConfirm) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showDeleteConfirm])

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
          onClick={handleDeleteClick}
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

      {/* Linked todo chip — or Link Todo button */}
      <div className="mb-6">
        {linkedTodo ? (
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
        ) : (
          <button
            onClick={() => setShowTodoPicker(true)}
            className="text-xs text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors duration-200 cursor-pointer"
          >
            + Link Todo
          </button>
        )}
      </div>

      {/* Editor */}
      <MilkdownEditor
        defaultValue={note.content}
        onChange={handleContentChange}
        onCheckboxToggle={async (text, checked) => {
          if (!id || !text) return
          const currentNote = notes.find((n) => n.id === id)
          const map = currentNote?.inline_todo_map ?? {}

          // Use the text as a simple key (first 50 chars)
          const key = text.slice(0, 50)
          const existingTodoId = map[key]

          if (existingTodoId) {
            // Toggle existing linked todo
            const existingTodo = todos.find((t) => t.id === existingTodoId)
            if (existingTodo) {
              if (checked) {
                await updateTodo(existingTodoId, { status: 'done', completed_at: new Date() })
              } else {
                await updateTodo(existingTodoId, { status: 'inbox', completed_at: undefined })
              }
            }
          } else if (checked) {
            // Create a new linked todo on first check
            const todoId = await addTodo({ title: text, status: 'done', note_id: id })
            await updateTodo(todoId, { completed_at: new Date() })
            await updateNote(id, {
              inline_todo_map: { ...map, [key]: todoId },
            })
          }
        }}
      />

      {/* Todo picker modal */}
      {showTodoPicker && (
        <LinkPicker
          items={todos
            .filter((t) => t.status !== 'done' && !t.note_id)
            .map((t) => ({ id: t.id, title: t.title }))}
          placeholder="Search todos..."
          createLabel="New todo"
          onClose={() => setShowTodoPicker(false)}
          onSelect={async (todoId) => {
            await updateNote(id!, { linked_todo_id: todoId })
            await updateTodo(todoId, { note_id: id! })
            setShowTodoPicker(false)
          }}
          onCreate={async (title) => {
            const todoId = await addTodo({ title: title || note.title, status: 'inbox' })
            await updateNote(id!, { linked_todo_id: todoId })
            await updateTodo(todoId, { note_id: id! })
            setShowTodoPicker(false)
          }}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-200 ${
            confirmVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeConfirm}
        >
          <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />
          <div
            className={`relative bg-surface-container-lowest rounded-2xl shadow-xl p-6 w-[min(360px,calc(100vw-2rem))] transition-transform duration-200 ease-out ${
              confirmVisible ? 'translate-y-0' : 'translate-y-4'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-on-surface mb-2">
              Delete note?
            </h2>
            <p className="text-on-surface-variant text-sm mb-6">
              This will permanently delete &ldquo;{note.title}&rdquo;. This can&rsquo;t be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 rounded-xl text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-error/10 text-error hover:bg-error/20 transition-colors duration-200 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
