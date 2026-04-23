import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import type { TodoSize } from '@/types'
import { ENERGY_LABELS, ENERGY_LEVELS } from '@/types'
import { useTodos } from '@/hooks/useTodos'
import { useNotes } from '@/hooks/useNotes'
import { useProjects } from '@/hooks/useProjects'
import { MenuButton } from '@/components/ui/MenuButton'
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

export function TodoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { todos, loading, updateTodo, pinToToday, moveToBacklog, removeTodo, completeTodo, deferTodo } = useTodos()
  const { notes, addNote, updateNote } = useNotes()
  const { projects } = useProjects()
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  const todo = todos.find((t) => t.id === id)

  const [showNotePicker, setShowNotePicker] = useState(false)
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false)
  const [showBreakdownPicker, setShowBreakdownPicker] = useState(false)
  const [granularity, setGranularity] = useState(3)
  const [liveDescription, setLiveDescription] = useState(todo?.description ?? '')
  const [showDescription, setShowDescription] = useState(!!todo?.description)

  const linkedNote = todo?.note_id ? notes.find((n) => n.id === todo.note_id) : undefined

  const setField = (field: string, value: unknown) => {
    if (!todo) return
    updateTodo(todo.id, { [field]: value })
  }

  // Auto-size title on load
  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [todo?.id])

  // Sync description state when navigating between todos
  useEffect(() => {
    setLiveDescription(todo?.description ?? '')
    setShowDescription(!!todo?.description)
  }, [todo?.id])

  const handleBack = () => {
    // Blur title to trigger save first
    titleRef.current?.blur()
    // Use history if available, else fall back to a sensible list
    if (window.history.length > 1) navigate(-1)
    else navigate('/backlog')
  }

  const handleComplete = () => {
    if (!todo) return
    completeTodo(todo.id)
    handleBack()
  }

  const handleAction = (action: () => void) => {
    action()
    handleBack()
  }

  // Defer helpers
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d }
  const nextWeek = () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d }
  const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setHours(9, 0, 0, 0); return d }

  // Not-found state
  if (!loading && !todo) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link to="/backlog" className="text-on-surface-variant text-sm hover:text-on-surface transition-colors">
            &larr; Backlog
          </Link>
          <MenuButton />
        </div>
        <div className="text-center py-20">
          <p className="text-on-surface font-display font-semibold text-base mb-1">Todo not found</p>
          <p className="text-on-surface-variant text-sm">It may have been deleted.</p>
        </div>
      </div>
    )
  }

  if (!todo) {
    return (
      <div>
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          onClick={handleBack}
          className="p-2.5 -ml-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          aria-label="Back"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <MenuButton />
      </div>

      <div className="space-y-7">
        {/* Title */}
        <div>
          <textarea
            ref={titleRef}
            defaultValue={todo.title}
            onChange={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== todo.title) setField('title', v)
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
            rows={1}
            className="w-full bg-transparent text-on-surface text-2xl md:text-3xl font-display font-bold tracking-tight outline-none placeholder:text-on-surface-variant/50 resize-none"
            placeholder="Todo title..."
          />
          {todo.project && (
            <p className="text-on-surface-variant text-xs mt-1">{todo.project}</p>
          )}
          {showDescription ? (
            <textarea
              value={liveDescription}
              onChange={(e) => {
                setLiveDescription(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onBlur={() => {
                const v = liveDescription.trim()
                if (v !== (todo.description ?? '')) setField('description', v || null)
              }}
              ref={(el) => {
                (descRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
                if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
              }}
              className="w-full bg-transparent text-on-surface-variant text-sm outline-none placeholder:text-on-surface-variant/40 mt-3 resize-none"
              placeholder="Add a description..."
              rows={1}
            />
          ) : (
            <button
              onClick={() => { setShowDescription(true); requestAnimationFrame(() => descRef.current?.focus()) }}
              className="text-on-surface-variant/50 text-xs mt-3 hover:text-on-surface-variant transition-colors cursor-pointer"
            >
              + Add description
            </button>
          )}
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-2 flex-wrap">
          {todo.status !== 'today_pinned' && (
            <button
              onClick={() => handleAction(() => pinToToday(todo.id))}
              className="px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant text-xs font-medium hover:text-on-surface transition-colors cursor-pointer min-h-[44px]"
            >
              Pin to Today
            </button>
          )}
          {todo.status !== 'backlog' && (
            <button
              onClick={() => handleAction(() => moveToBacklog(todo.id))}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[44px] ${
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

          {/* Time estimate */}
          <div>
            <label className="text-xs text-on-surface-variant mb-2 block font-medium">Time estimate</label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {[5, 15, 25, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setField('estimated_minutes', todo.estimated_minutes === mins ? null : mins)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer min-h-[44px] shrink-0 ${
                    todo.estimated_minutes === mins
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                </button>
              ))}
            </div>
          </div>

          {/* Project + Due date row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface text-sm outline-none min-h-[44px] max-w-full"
              />
            </div>
          </div>
        </div>

        {/* Defer, Remind, Note, Unstick row */}
        <div className="border-t border-outline-variant/15 pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Defer */}
            <div className="relative">
              <details className="group/defer">
                <summary className="px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant text-xs font-medium hover:text-on-surface transition-colors cursor-pointer list-none min-h-[44px] flex items-center">
                  Defer
                </summary>
                <div className="absolute left-0 top-full mt-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[140px]">
                  <button
                    onClick={() => { deferTodo(todo.id, tomorrow()); handleBack() }}
                    className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    Tomorrow
                  </button>
                  <button
                    onClick={() => { deferTodo(todo.id, nextWeek()); handleBack() }}
                    className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    Next week
                  </button>
                  <button
                    onClick={() => { deferTodo(todo.id, nextMonth()); handleBack() }}
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
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer min-h-[44px] ${
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
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer min-h-[44px] ${
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
                  onChange={(rule) => updateTodo(todo.id, { recurrence: rule as never })}
                  onClose={() => setShowRecurrencePicker(false)}
                />
              )}
            </div>

            {/* AI Breakdown */}
            <div className="relative">
              <button
                onClick={() => setShowBreakdownPicker(!showBreakdownPicker)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant text-xs font-medium hover:text-on-surface transition-colors cursor-pointer min-h-[44px]"
              >
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0l1.5 5.5L16 8l-6.5 2.5L8 16l-1.5-5.5L0 8l6.5-2.5z" />
                </svg>
                Unstick Me
              </button>
              {showBreakdownPicker && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[260px]">
                  {/* Granularity slider */}
                  <div className="px-4 pt-2 pb-3 border-b border-outline-variant/15">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-on-surface-variant font-medium">Detail level</label>
                      <span className="text-xs text-on-surface-variant">
                        {granularity === 1 ? 'Broad strokes' : granularity === 2 ? 'Overview' : granularity === 3 ? 'Concrete' : granularity === 4 ? 'Detailed' : 'Baby steps'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={granularity}
                      onChange={(e) => setGranularity(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-surface-container-high"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-on-surface-variant/50">1</span>
                      <span className="text-[10px] text-on-surface-variant/50">5</span>
                    </div>
                  </div>

                  {/* Style buttons */}
                  <button
                    onClick={() => navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=micro-steps&granularity=${granularity}`)}
                    className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    <span className="font-medium">Micro-steps</span>
                    <p className="text-xs text-on-surface-variant mt-0.5">Break it into tiny, easy steps</p>
                  </button>
                  <button
                    onClick={() => navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=gamify&granularity=${granularity}`)}
                    className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    <span className="font-medium">Gamify it</span>
                    <p className="text-xs text-on-surface-variant mt-0.5">Make it fun and stimulating</p>
                  </button>
                  <button
                    onClick={() => navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=transition-protocol&granularity=${granularity}`)}
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
                onClick={() => navigate(`/notes/${linkedNote.id}`)}
                className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer min-h-[44px]"
              >
                ¶ {linkedNote.title}
              </button>
            ) : (
              <button
                onClick={() => setShowNotePicker(true)}
                className="px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant text-xs font-medium hover:text-on-surface transition-colors cursor-pointer min-h-[44px]"
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

      {/* Note picker modal */}
      {showNotePicker && (
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
            navigate(`/notes/${noteId}`)
          }}
        />
      )}
    </div>
  )
}
