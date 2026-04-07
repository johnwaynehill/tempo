import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import type { Todo, TodoSize } from '@/types'
import { ENERGY_LABELS, ENERGY_LEVELS } from '@/types'
import { useTodos } from '@/hooks/useTodos'
import { useNotes } from '@/hooks/useNotes'
import { useProjects } from '@/hooks/useProjects'
import { useSmartCapture } from '@/hooks/useSmartCapture'
import { LinkPicker } from '@/components/ui/LinkPicker'
import { ReminderPicker } from '@/components/ui/ReminderPicker'
import { RecurrencePicker } from '@/components/ui/RecurrencePicker'
import { ProjectPicker } from '@/components/ui/ProjectPicker'
import { SmartCaptureSuggestions } from '@/components/ui/SmartCaptureSuggestions'
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
  const [granularity, setGranularity] = useState(3)
  const [visible, setVisible] = useState(false)
  const [liveTitle, setLiveTitle] = useState(todo.title)

  const linkedNote = todo.note_id ? notes.find((n) => n.id === todo.note_id) : undefined
  const isNewTodo = !todo.title.trim()

  // Smart capture: suggest metadata for new todos
  const projectNames = projects // already string[]
  const { suggestions } = useSmartCapture(liveTitle, isNewTodo, projectNames)

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
        {/* Drag handle / close zone */}
        <div
          className="flex justify-center pt-4 pb-2 cursor-pointer"
          onClick={handleClose}
        >
          <div className="w-10 h-1.5 rounded-full bg-outline-variant/40" />
        </div>

        <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 space-y-7">
          {/* Title */}
          <div>
            <input
              ref={titleRef}
              type="text"
              defaultValue={todo.title}
              onChange={(e) => setLiveTitle(e.target.value)}
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

          {/* AI suggestions for new todos */}
          {isNewTodo && suggestions && (
            <SmartCaptureSuggestions
              suggestions={suggestions}
              setFields={{
                energy_level: !!todo.energy_level,
                size: !!todo.size,
                project: !!todo.project,
                impact: !!todo.impact,
                estimated_minutes: !!todo.estimated_minutes,
                due_date: !!todo.due_date,
              }}
              onAcceptAll={(s) => {
                if (s.energy_level) setField('energy_level', s.energy_level)
                if (s.size) setField('size', s.size)
                if (s.project) setField('project', s.project)
                if (s.impact) setField('impact', s.impact)
                if (s.estimated_minutes) setField('estimated_minutes', s.estimated_minutes)
                if (s.due_date) setField('due_date', new Date(s.due_date + 'T00:00:00'))
              }}
            />
          )}

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
                  className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface text-base outline-none min-h-[44px]"
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
                  <summary className="px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant text-xs font-medium hover:text-on-surface transition-colors cursor-pointer list-none min-h-[44px] flex items-center">
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
                    onChange={(rule) => updateTodo(todo.id, { recurrence: rule as any })}
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
                  <div className="absolute left-0 bottom-full mb-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[260px]">
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
                      onClick={() => {
                        navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=micro-steps&granularity=${granularity}`)
                        handleClose()
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <span className="font-medium">Micro-steps</span>
                      <p className="text-xs text-on-surface-variant mt-0.5">Break it into tiny, easy steps</p>
                    </button>
                    <button
                      onClick={() => {
                        navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=gamify&granularity=${granularity}`)
                        handleClose()
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <span className="font-medium">Gamify it</span>
                      <p className="text-xs text-on-surface-variant mt-0.5">Make it fun and stimulating</p>
                    </button>
                    <button
                      onClick={() => {
                        navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=transition-protocol&granularity=${granularity}`)
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

          {/* Bottom actions: Delete + Complete/Add */}
          <div className="border-t border-outline-variant/15 pt-4 flex items-center gap-3">
            <button
              onClick={() => handleAction(() => removeTodo(todo.id))}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-error/70 hover:text-error hover:bg-error/5 text-sm font-medium transition-colors cursor-pointer"
            >
              {isNewTodo ? 'Discard' : 'Delete'}
            </button>
            {isNewTodo ? (
              <button
                onClick={handleClose}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                Add Todo
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2.5 6L5 8.5L9.5 3.5" />
                </svg>
                Complete
              </button>
            )}
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
