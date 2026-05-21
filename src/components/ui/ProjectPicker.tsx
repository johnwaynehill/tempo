import { useState, useEffect, useMemo, useRef } from 'react'

interface ProjectPickerProps {
  value: string | null
  projects: string[]
  onChange: (project: string | null) => void
}

/**
 * Project selector for the full Todo detail page.
 *
 * Renders a button-styled trigger that looks like our other form inputs.
 * Tapping it opens a sheet — bottom-sheet on mobile, centered modal on
 * desktop (`items-end md:items-center` does the heavy lifting). Inside:
 * search input, the project list, optional "None" to clear, and a
 * "Create new" option when the search doesn't match an existing project.
 *
 * Why not the inline popover we used to ship? On mobile, anchoring a popover
 * to an input inside scrollable content with the iOS keyboard open is a
 * structural fight we kept losing. A sheet that owns the viewport is
 * simpler, more discoverable, and gives the user real room to pick.
 *
 * For the quick-capture drawer (`TodoDetailDrawer`), see `ProjectChips` —
 * that flow uses flat one-tap chips because adding even a sheet feels like
 * friction in capture-mode.
 */
export function ProjectPicker({ value, projects, onChange }: ProjectPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Reset query + focus the search input when opening
  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlightIndex(-1)
      // Defer focus until after the sheet has rendered + transitioned in
      const t = setTimeout(() => searchInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Close on Escape. Registered in the capture phase with
  // `stopImmediatePropagation` so the page-level Esc handler (e.g. on
  // TodoDetailPage, which navigates back) doesn't also fire — Esc should
  // close one layer at a time.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.toLowerCase().includes(q))
  }, [projects, query])

  const trimmedQuery = query.trim()
  // Show a "Create" option when the query doesn't match an existing project
  const canCreate =
    trimmedQuery !== '' &&
    !projects.some((p) => p.toLowerCase() === trimmedQuery.toLowerCase())

  const select = (project: string | null) => {
    onChange(project)
    setOpen(false)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    const itemCount = filtered.length + (canCreate ? 1 : 0)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex((i) => Math.min(i + 1, itemCount - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex((i) => Math.max(i - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          select(filtered[highlightIndex])
        } else if (highlightIndex === filtered.length && canCreate) {
          select(trimmedQuery)
        } else if (canCreate) {
          // No explicit highlight — Enter still creates the new project
          select(trimmedQuery)
        } else if (filtered.length === 1) {
          // Single match, no ambiguity
          select(filtered[0])
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <>
      {/* Trigger — looks like our other form inputs */}
      <div className="relative w-full">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`w-full bg-surface-container rounded-lg px-3 py-2.5 text-sm min-h-[44px] flex items-center justify-between gap-2 cursor-pointer hover:bg-surface-container-high transition-colors text-left ${
            value ? 'pr-10' : ''
          }`}
        >
          <span className={value ? 'text-on-surface' : 'text-on-surface-variant/50'}>
            {value ?? 'Select project'}
          </span>
          <svg
            className="w-3 h-3 text-on-surface-variant shrink-0"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M3 5l3 3 3-3" />
          </svg>
        </button>
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            aria-label="Clear project"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Sheet on mobile, modal on desktop — `items-end md:items-center`
          does the layout switch entirely in CSS. */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />
          <div
            className="relative w-full max-h-[70vh] md:w-[420px] md:max-h-[60vh] bg-surface-container-lowest rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile only) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-10 h-1.5 rounded-full bg-outline-variant/40 hover:bg-outline-variant/60 transition-colors cursor-pointer"
              />
            </div>

            {/* Header (desktop only) */}
            <div className="hidden md:flex items-center justify-between px-5 pt-5 pb-2">
              <h2 className="text-on-surface font-display text-base font-semibold">Select project</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </div>

            {/* Search input */}
            <div className="px-4 md:px-5 py-2">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHighlightIndex(-1) }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search or type new..."
                className="w-full bg-surface-container rounded-lg px-3 py-2.5 text-on-surface text-base outline-none placeholder:text-on-surface-variant/40 min-h-[44px]"
              />
            </div>

            {/* Project list */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
              {/* Clear / None option (only shown when a value is currently set
                  and the user isn't filtering) */}
              {value && trimmedQuery === '' && (
                <button
                  type="button"
                  onClick={() => select(null)}
                  className="w-full text-left px-3 py-3 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer min-h-[44px] flex items-center gap-2"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                  Clear project
                </button>
              )}

              {filtered.length === 0 && !canCreate && (
                <p className="text-on-surface-variant/60 text-sm italic text-center py-8">
                  No projects match
                </p>
              )}

              {filtered.map((project, i) => (
                <button
                  key={project}
                  type="button"
                  onClick={() => select(project)}
                  className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors cursor-pointer min-h-[44px] flex items-center justify-between gap-2 ${
                    i === highlightIndex
                      ? 'bg-surface-container'
                      : value === project
                        ? 'text-primary font-medium bg-primary/5'
                        : 'text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span>{project}</span>
                  {value === project && (
                    <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}

              {canCreate && (
                <button
                  type="button"
                  onClick={() => select(trimmedQuery)}
                  className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors cursor-pointer min-h-[44px] flex items-center gap-2 ${
                    highlightIndex === filtered.length
                      ? 'bg-surface-container'
                      : 'text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <svg className="w-4 h-4 text-on-surface-variant shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create &ldquo;{trimmedQuery}&rdquo;
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
