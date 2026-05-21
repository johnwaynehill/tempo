import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import type { TodoSize } from '@/types'
import { ENERGY_LABELS, ENERGY_LEVELS } from '@/types'
import { useTodos } from '@/hooks/useTodos'
import { useNotes } from '@/hooks/useNotes'
import { useProjects } from '@/hooks/useProjects'
import { LinkPicker } from '@/components/ui/LinkPicker'
import { ReminderPicker } from '@/components/ui/ReminderPicker'
import { RecurrencePicker } from '@/components/ui/RecurrencePicker'
import { ProjectPicker } from '@/components/ui/ProjectPicker'
import { DateField } from '@/components/ui/DateField'
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
  const [showOverflowMenu, setShowOverflowMenu] = useState(false)
  const [showDeferMenu, setShowDeferMenu] = useState(false)
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

  // Map a todo's status to the list page it lives on
  const statusListInfo = (status: string | undefined): { label: string; path: string } => {
    switch (status) {
      case 'inbox': return { label: 'Inbox', path: '/inbox' }
      case 'today_pinned': return { label: 'Today', path: '/today' }
      case 'done': return { label: 'Completed', path: '/completed' }
      case 'deferred': return { label: 'Backlog', path: '/backlog' }
      case 'backlog':
      default: return { label: 'Backlog', path: '/backlog' }
    }
  }
  const backInfo = statusListInfo(todo?.status)

  const handleBack = () => {
    titleRef.current?.blur()
    if (window.history.length > 1) navigate(-1)
    else navigate(backInfo.path)
  }

  // Esc closes the page (and goes back to the previous view, preserving any
  // search-param state on the source — e.g. filters on Backlog). Skipped when
  // a modal/menu is open so the inner Esc handler closes that first.
  useEffect(() => {
    const anyOverlayOpen =
      showDeferMenu || showOverflowMenu || showRecurrencePicker
      || showReminderPicker || showNotePicker || showBreakdownPicker
    if (anyOverlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeferMenu, showOverflowMenu, showRecurrencePicker, showReminderPicker, showNotePicker, showBreakdownPicker, navigate, backInfo.path])

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

  // Reusable bottom-bar action buttons. Defined inline to share state.
  const DeferButton = () => (
    <div className="relative">
      <button
        onClick={() => setShowDeferMenu(!showDeferMenu)}
        className="flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-surface-container text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors cursor-pointer min-h-[44px]"
      >
        Defer
        <svg className="w-3 h-3 opacity-60" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>
      {showDeferMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDeferMenu(false)} />
          <div className="absolute left-0 bottom-full mb-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[160px]">
            <button onClick={() => { setShowDeferMenu(false); deferTodo(todo.id, tomorrow()); handleBack() }} className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer">Tomorrow</button>
            <button onClick={() => { setShowDeferMenu(false); deferTodo(todo.id, nextWeek()); handleBack() }} className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer">Next week</button>
            <button onClick={() => { setShowDeferMenu(false); deferTodo(todo.id, nextMonth()); handleBack() }} className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer">Next month</button>
          </div>
        </>
      )}
    </div>
  )

  const UnstickButton = () => (
    <div className="relative">
      <button
        onClick={() => setShowBreakdownPicker(!showBreakdownPicker)}
        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-surface-container text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors cursor-pointer min-h-[44px]"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0l1.5 5.5L16 8l-6.5 2.5L8 16l-1.5-5.5L0 8l6.5-2.5z" />
        </svg>
        Unstick
      </button>
      {showBreakdownPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowBreakdownPicker(false)} />
          <div className="absolute left-0 bottom-full mb-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[260px]">
            <div className="px-4 pt-2 pb-3 border-b border-outline-variant/15">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-on-surface-variant font-medium">Detail level</label>
                <span className="text-xs text-on-surface-variant">
                  {granularity === 1 ? 'Broad strokes' : granularity === 2 ? 'Overview' : granularity === 3 ? 'Concrete' : granularity === 4 ? 'Detailed' : 'Baby steps'}
                </span>
              </div>
              <input type="range" min={1} max={5} step={1} value={granularity} onChange={(e) => setGranularity(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-surface-container-high" />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-on-surface-variant/50">1</span>
                <span className="text-[10px] text-on-surface-variant/50">5</span>
              </div>
            </div>
            <button onClick={() => navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=micro-steps&granularity=${granularity}`)} className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer">
              <span className="font-medium">Micro-steps</span>
              <p className="text-xs text-on-surface-variant mt-0.5">Break it into tiny, easy steps</p>
            </button>
            <button onClick={() => navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=gamify&granularity=${granularity}`)} className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer">
              <span className="font-medium">Gamify it</span>
              <p className="text-xs text-on-surface-variant mt-0.5">Make it fun and stimulating</p>
            </button>
            <button onClick={() => navigate(`/chat?mode=breakdown&todoId=${todo.id}&style=transition-protocol&granularity=${granularity}`)} className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer">
              <span className="font-medium">Transition protocol</span>
              <p className="text-xs text-on-surface-variant mt-0.5">Gently shift out of freeze mode</p>
            </button>
          </div>
        </>
      )}
    </div>
  )

  const CompleteButton = () => (
    <button
      onClick={handleComplete}
      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px]"
    >
      <svg className="w-4 h-4" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M2.5 6L5 8.5L9.5 3.5" />
      </svg>
      Complete
    </button>
  )

  return (
    <div className="pb-24 md:pb-20">
      {/* Page header — back + overflow */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 pl-1.5 pr-3 py-2 -ml-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          aria-label={`Back to ${backInfo.label}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-sm font-medium">{backInfo.label}</span>
        </button>

        {/* Overflow menu */}
        <div className="relative">
          <button
            onClick={() => setShowOverflowMenu(!showOverflowMenu)}
            className="p-2.5 -mr-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="More actions"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>

          {showOverflowMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowOverflowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[220px]">
                {todo.status !== 'today_pinned' && (
                  <button
                    onClick={() => { setShowOverflowMenu(false); handleAction(() => pinToToday(todo.id)) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Pin to Today
                  </button>
                )}
                {todo.status !== 'backlog' && (
                  <button
                    onClick={() => { setShowOverflowMenu(false); handleAction(() => moveToBacklog(todo.id)) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    Move to Backlog
                  </button>
                )}

                <div className="border-t border-outline-variant/15 my-1.5" />

                <button
                  onClick={() => { setShowOverflowMenu(false); setShowReminderPicker(true) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {todo.reminder_at ? 'Edit reminder…' : 'Set reminder…'}
                </button>
                <button
                  onClick={() => { setShowOverflowMenu(false); setShowRecurrencePicker(true) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                  {todo.recurrence ? 'Edit repeat…' : 'Repeat…'}
                </button>
                <button
                  onClick={() => { setShowOverflowMenu(false); setShowNotePicker(true) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {linkedNote ? `Linked: ${linkedNote.title}` : 'Link to note…'}
                </button>

                <div className="border-t border-outline-variant/15 my-1.5" />

                <button
                  onClick={() => { setShowOverflowMenu(false); handleAction(() => removeTodo(todo.id)) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error/5 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-7">
        {/* Title + description */}
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
              <DateField
                value={todo.due_date ?? null}
                onChange={(date) => setField('due_date', date)}
              />
            </div>
          </div>
        </div>

        {/* Active secondary state summary — reminder / repeat / linked note shown inline for scannability */}
        {(todo.reminder_at || todo.recurrence || linkedNote) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {todo.reminder_at && (
              <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium inline-flex items-center gap-1.5">
                🔔 {todo.reminder_at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {todo.recurrence && (
              <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                {describeRecurrence(todo.recurrence)}
              </span>
            )}
            {linkedNote && (
              <button
                onClick={() => navigate(`/notes/${linkedNote.id}`)}
                className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer"
              >
                ¶ {linkedNote.title}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom action bar — sits above the mobile tab bar.
          Action buttons are status-aware so the most useful next-step
          decisions are always one tap away. */}
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 md:left-52 z-30 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/15 md:pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-2xl mx-auto px-5 md:px-10 py-3 flex items-center gap-2">
          {todo.status === 'inbox' ? (
            <>
              {/* Inbox triage: Pin to Today + Move to Backlog (primary) */}
              <button
                onClick={() => handleAction(() => pinToToday(todo.id))}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-surface-container text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors cursor-pointer min-h-[44px]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Today
              </button>
              <button
                onClick={() => handleAction(() => moveToBacklog(todo.id))}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                Move to Backlog
              </button>
            </>
          ) : todo.status === 'backlog' || todo.status === 'deferred' ? (
            <>
              {/* Backlog: Pin to Today + Unstick + Complete (primary) */}
              <button
                onClick={() => handleAction(() => pinToToday(todo.id))}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-surface-container text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors cursor-pointer min-h-[44px]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Today
              </button>
              <UnstickButton />
              <CompleteButton />
            </>
          ) : (
            <>
              {/* Today (and any other status): Defer + Unstick + Complete */}
              <DeferButton />
              <UnstickButton />
              <CompleteButton />
            </>
          )}
        </div>
      </div>

      {/* Reminder picker (opened from overflow menu) */}
      {showReminderPicker && (
        <ReminderPicker
          currentReminder={todo.reminder_at}
          onSet={(date) => updateTodo(todo.id, { reminder_at: date })}
          onClear={() => updateTodo(todo.id, { reminder_at: undefined })}
          onClose={() => setShowReminderPicker(false)}
        />
      )}

      {/* Recurrence picker */}
      {showRecurrencePicker && (
        <RecurrencePicker
          value={todo.recurrence}
          onChange={(rule) => updateTodo(todo.id, { recurrence: rule as never })}
          onClose={() => setShowRecurrencePicker(false)}
        />
      )}

      {/* Note picker */}
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
