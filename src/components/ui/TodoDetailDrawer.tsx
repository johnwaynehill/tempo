import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import type { Todo, TodoSize } from '@/types'
import { ENERGY_LABELS, ENERGY_LEVELS } from '@/types'
import { useTodos } from '@/hooks/useTodos'
import { useNotes } from '@/hooks/useNotes'
import { useProjects } from '@/hooks/useProjects'
import { LinkPicker } from '@/components/ui/LinkPicker'
import { ReminderPicker } from '@/components/ui/ReminderPicker'
import { RecurrencePicker } from '@/components/ui/RecurrencePicker'
import { ProjectPicker } from '@/components/ui/ProjectPicker'
import { describeRecurrence } from '@/lib/recurrence'

const SIZE_LABELS: Record<TodoSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

interface TodoDetailDrawerProps {
  todo: Todo
  onClose: () => void
  onComplete: (id: string) => void
  onDefer: (id: string, until?: Date) => void
}

export function TodoDetailDrawer({ todo, onClose, onComplete, onDefer }: TodoDetailDrawerProps) {
  const { updateTodo, pinToToday, moveToBacklog, removeTodo } = useTodos()
  const { notes, addNote, updateNote } = useNotes()
  const { projects } = useProjects()
  const navigate = useNavigate()
  const titleRef = useRef<HTMLInputElement>(null)

  const [showNotePicker, setShowNotePicker] = useState(false)
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false)
  const [showBreakdownPicker, setShowBreakdownPicker] = useState(false)
  const [visible, setVisible] = useState(false)

  const linkedNote = todo.note_id ? notes.find((n) => n.id === todo.note_id) : undefined

  const setField = (field: string, value: unknown) => {
    updateTodo(todo.id, { [field]: value })
  }

  // Animate in and focus title
  useEffect(() => {
    requestAnimationFrame(() => {
      setVisible(true)
      titleRef.current?.focus()
    })
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleClose = () => {
    // Blur the title input to trigger save before closing
    titleRef.current?.blur()
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const handleComplete = () => {
    onComplete(todo.id)
    handleClose()
  }

  const handleAction = (action: () => void) => {
    action()
    handleClose()
  }

  // Defer helpers
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d }
  const nextWeek = () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d }
  const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setHours(9, 0, 0, 0); return d }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end md:items-center justify-center transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />

      {/* Drawer panel */}
      <div
        className={`relative w-full max-h-[90vh] md:w-[520px] md:max-h-[85vh] bg-surface-container-lowest rounded-t-2xl md:rounded-2xl shadow-xl overflow-y-auto transition-transform duration-200 ease-out ${
          visible
            ? 'translate-y-0'
            : 'translate-y-8 md:translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full bg-outline-variant/30" />
        </div>

        <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 space-y-7">
          {/* Title */}
          <div>
            <input
              ref={titleRef}
              type="text"
              defaultValue={todo.title}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== todo.title) setField('title', v)
              }}
              className="w-full bg-transparent text-on-surface text-lg font-medium outline-none placeholder:text-on-surface-variant/50"
              placeholder="Todo title..."
            />
            {todo.project && (
              <p className="text-on-surface-variant text-xs mt-1">{todo.project}</p>
            )}
          </div>

          {/* Quick actions row */}
          <div className="flex items-center gap-2 flex-wrap">
            {todo.status !== 'today_pinned' && (
              <button
                onClick={() => handleAction(() => pinToToday(todo.id))}
                className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-xs font-medium hover:text-on-surface transition-colors cursor-pointer"
              >
                Pin to Today
              </button>
            )}
            {todo.status !== 'backlog' && (
              <button
                onClick={() => handleAction(() => moveToBacklog(todo.id))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  todo.status === 'inbox'
                    ? 'bg-gradient-to-br from-primary to-primary-dim text-on-primary hover:shadow-md'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Move to Backlog
              </button>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-5">
            {/* Energy */}
            <div>
              <label className="text-xs text-on-surface-variant mb-2 block font-medium">Energy</label>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {ENERGY_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setField('energy_level', todo.energy_level === level ? null : level)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer min-h-[44px] shrink-0 ${
                      todo.energy_level === level
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {ENERGY_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <label className="text-xs text-on-surface-variant mb-2 block font-medium">Size</label>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {(['small', 'medium', 'large'] as TodoSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setField('size', todo.size === size ? null : size)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer min-h-[44px] shrink-0 ${
                      todo.size === size
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {SIZE_LABELS[size]}
                  </button>
                ))}
              </div>
            </div>

            {/* Impact */}
            <div>
              <label className="text-xs text-on-surface-variant mb-2 block font-medium">Impact</label>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setField('impact', todo.impact === n ? null : n)}
                    className={`w-11 h-11 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer shrink-0 ${
                      todo.impact === n
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Project + Due date row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-on-surface-variant mb-2 block font-medium">Project</label>
                <ProjectPicker
                  value={todo.project ?? null}
                  projects={projects}
                  onChange={(project) => setField('project', project)}
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant mb-2 block font-medium">Due date</label>
                <input
                  type="date"
                  defaultValue={todo.due_date?.toISOString().split('T')[0] ?? ''}
                  onChange={(e) => setField('due_date', e.target.value ? new Date(e.target.value + 'T00:00:00') : null)}
                  className="w-full bg-surface-container rounded-lg px-3 py-2 text-on-surface text-sm outline-none"
                />
              </div>
            </div>
          </div>

          {/* Defer, Remind, Note, Delete row */}
          <div className="border-t border-outline-variant/15 pt-4">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Defer */}
              <div className="relative">
                <button
                  onClick={() => {}}
                  className="hidden"
                />
                <details className="group/defer">
                  <summary className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-xs font-medium hover:text-on-surface transition-colors cursor-pointer list-none">
                    Defer
                  </summary>
                  <div className="absolute left-0 bottom-full mb-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[140px]">
                    <button
                      onClick={() => { onDefer(todo.id, tomorrow()); handleClose() }}
                      className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      Tomorrow
                    </button>
                    <button
                      onClick={() => { onDefer(todo.id, nextWeek()); handleClose() }}
                      className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      Next week
                    </button>
                    <button
                      onClick={() => { onDefer(todo.id, nextMonth()); handleClose() }}
                      className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      Next month
                    </button>
                  </div>
                </details>
              </div>

              {/* Reminder */}
              <div className="relative">
                <button
                  onClick={() => setShowReminderPicker(!showReminderPicker)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                    todo.reminder_at
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {todo.reminder_at ? '🔔 Reminder set' : 'Remind'}
                </button>
                {showReminderPicker && (
                  <ReminderPicker
                    currentReminder={todo.reminder_at}
                    onSet={(date) => updateTodo(todo.id, { reminder_at: date })}
                    onClear={() => updateTodo(todo.id, { reminder_at: undefined })}
                    onClose={() => setShowReminderPicker(false)}
                  />
                )}
              </div>

              {/* Recurrence */}
              <div className="relative">
                <button
                  onClick={() => setShowRecurrencePicker(!showRecurrencePicker)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                    todo.recurrence
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {todo.recurrence ? describeRecurrence(todo.recurrence) : 'Repeat'}
                </button>
                {showRecurrencePicker && (
                  <RecurrencePicker
                    value={todo.recurrence}
                    onChange={(rule) => updateTodo(todo.id, { recurrence: rule as any })}
                    onClose={() => setShowRecurrencePicker(false)}
                  />
                )}
              </div>

              {/* AI Breakdown */}
              <div className="relative">
                <button
                  onClick={() => setShowBreakdownPicker(!showBreakdownPicker)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-xs font-medium hover:text-on-surface transition-colors cursor-pointer"
                >
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0l1.5 5.5L16 8l-6.5 2.5L8 16l-1.5-5.5L0 8l6.5-2.5z" />
                  </svg>
                  Unstick Me
                </button>
                {showBreakdownPicker && (
                  <div className="absolute left-0 bottom-full mb-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[220px]">
                    <button
                      onClick={() => {
                        navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=micro-steps`)
                        handleClose()
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <span className="font-medium">Micro-steps</span>
                      <p className="text-xs text-on-surface-variant mt-0.5">Break it into tiny, easy steps</p>
                    </button>
                    <button
                      onClick={() => {
                        navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=gamify`)
                        handleClose()
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <span className="font-medium">Gamify it</span>
                      <p className="text-xs text-on-surface-variant mt-0.5">Make it fun and stimulating</p>
                    </button>
                    <button
                      onClick={() => {
                        navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=transition-protocol`)
                        handleClose()
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <span className="font-medium">Transition protocol</span>
                      <p className="text-xs text-on-surface-variant mt-0.5">Gently shift out of freeze mode</p>
                    </button>
                  </div>
                )}
              </div>

              {/* Note link */}
              {linkedNote ? (
                <button
                  onClick={() => { navigate(`/notes/${linkedNote.id}`); handleClose() }}
                  className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  ¶ {linkedNote.title}
                </button>
              ) : (
                <button
                  onClick={() => setShowNotePicker(true)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-xs font-medium hover:text-on-surface transition-colors cursor-pointer"
                >
                  Link Note
                </button>
              )}

            </div>
          </div>

          {/* Bottom actions: Delete + Complete */}
          <div className="border-t border-outline-variant/15 pt-4 flex items-center gap-3">
            <button
              onClick={() => handleAction(() => removeTodo(todo.id))}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-error/70 hover:text-error hover:bg-error/5 text-sm font-medium transition-colors cursor-pointer"
            >
              Delete
            </button>
            <button
              onClick={handleComplete}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2.5 6L5 8.5L9.5 3.5" />
              </svg>
              Complete
            </button>
          </div>
        </div>
      </div>

      {/* Note picker (renders as its own modal layer) */}
      {showNotePicker && (
        <div onClick={(e) => e.stopPropagation()}>
          <LinkPicker
            items={notes.filter((n) => !n.linked_todo_id).map((n) => ({ id: n.id, title: n.title }))}
            placeholder="Search notes..."
            createLabel="New note"
            onClose={() => setShowNotePicker(false)}
            onSelect={async (noteId) => {
              await updateTodo(todo.id, { note_id: noteId })
              await updateNote(noteId, { linked_todo_id: todo.id })
              setShowNotePicker(false)
            }}
            onCreate={async (title) => {
              const noteId = await addNote(title || todo.title)
              await updateTodo(todo.id, { note_id: noteId })
              await updateNote(noteId, { linked_todo_id: todo.id })
              setShowNotePicker(false)
              handleClose()
              navigate(`/notes/${noteId}`)
            }}
          />
        </div>
      )}
    </div>
  )
}
