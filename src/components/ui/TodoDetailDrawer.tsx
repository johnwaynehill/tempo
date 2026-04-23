import { useState, useEffect, useRef } from 'react'
import type { Todo } from '@/types'
import { useTodos } from '@/hooks/useTodos'
import { useProjects } from '@/hooks/useProjects'
import { useSmartCapture } from '@/hooks/useSmartCapture'
import { ProjectPicker } from '@/components/ui/ProjectPicker'
import { SmartCaptureSuggestions } from '@/components/ui/SmartCaptureSuggestions'

interface TodoDetailDrawerProps {
  todo: Todo
  onClose: () => void
  onComplete: (id: string) => void
  onDefer: (id: string, until?: Date) => void
}

/**
 * Lightweight capture drawer for NEW todos only. Existing todos open
 * the full page at /todos/:id. Kept minimal on purpose — fields you
 * skip here are easy to add during Inbox triage.
 *
 * onComplete and onDefer remain in the props for API stability with
 * existing callers, but aren't used in the capture flow.
 */
export function TodoDetailDrawer({ todo, onClose }: TodoDetailDrawerProps) {
  const { updateTodo, removeTodo } = useTodos()
  const { projects } = useProjects()
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  const [visible, setVisible] = useState(false)
  const [liveTitle, setLiveTitle] = useState(todo.title)
  const [showDescription, setShowDescription] = useState(!!todo.description)
  const [liveDescription, setLiveDescription] = useState(todo.description ?? '')

  // Smart capture: suggest metadata based on title
  const { suggestions } = useSmartCapture(liveTitle, true, projects)

  const setField = (field: string, value: unknown) => {
    updateTodo(todo.id, { [field]: value })
  }

  // Animate in and autofocus title
  useEffect(() => {
    requestAnimationFrame(() => {
      setVisible(true)
      const el = titleRef.current
      if (el) {
        el.focus()
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
      }
    })
  }, [])

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
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
    titleRef.current?.blur()
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const handleDiscard = () => {
    removeTodo(todo.id)
    handleClose()
  }

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
        className={`relative w-full max-h-[90vh] md:w-[480px] md:max-h-[80vh] bg-surface-container-lowest rounded-t-2xl md:rounded-2xl shadow-xl overflow-y-auto transition-transform duration-200 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-8 md:translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle + close */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="w-8" />
          <div
            className="w-10 h-1.5 rounded-full bg-outline-variant/40 cursor-pointer"
            onClick={handleClose}
          />
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 space-y-5">
          {/* Title + description */}
          <div>
            <textarea
              ref={titleRef}
              defaultValue={todo.title}
              onChange={(e) => {
                setLiveTitle(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== todo.title) setField('title', v)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
              rows={1}
              className="w-full bg-transparent text-on-surface text-lg font-medium outline-none placeholder:text-on-surface-variant/50 resize-none"
              placeholder="What needs doing?"
            />
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
                className="w-full bg-transparent text-on-surface-variant text-sm outline-none placeholder:text-on-surface-variant/40 mt-2 resize-none"
                placeholder="Add a description..."
                rows={1}
              />
            ) : (
              <button
                onClick={() => { setShowDescription(true); requestAnimationFrame(() => descRef.current?.focus()) }}
                className="text-on-surface-variant/50 text-xs mt-2 hover:text-on-surface-variant transition-colors cursor-pointer"
              >
                + Add description
              </button>
            )}
          </div>

          {/* AI smart-capture suggestions */}
          {suggestions && (
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

          {/* Project + Due date */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-on-surface-variant mb-1.5 block font-medium">Project</label>
              <ProjectPicker
                value={todo.project ?? null}
                projects={projects}
                onChange={(project) => setField('project', project)}
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant mb-1.5 block font-medium">Due date</label>
              <input
                type="date"
                defaultValue={todo.due_date?.toISOString().split('T')[0] ?? ''}
                onChange={(e) => setField('due_date', e.target.value ? new Date(e.target.value + 'T00:00:00') : null)}
                className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface text-sm outline-none min-h-[44px] max-w-full"
              />
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleDiscard}
              className="px-4 py-2.5 rounded-xl text-error/70 hover:text-error hover:bg-error/5 text-sm font-medium transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              onClick={handleClose}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-dim transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v10M3 8h10" />
              </svg>
              Add Todo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
