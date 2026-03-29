import { useState, useRef, useEffect, useMemo } from 'react'

interface ProjectPickerProps {
  value: string | null
  projects: string[]
  onChange: (project: string | null) => void
}

export function ProjectPicker({ value, projects, onChange }: ProjectPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value ?? '')
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync query with external value when dropdown is closed
  useEffect(() => {
    if (!open) setQuery(value ?? '')
  }, [value, open])

  // Filter projects by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.toLowerCase().includes(q))
  }, [projects, query])

  // Reset highlight when options change
  useEffect(() => {
    setHighlightIndex(-1)
  }, [filtered.length])

  const select = (project: string | null) => {
    onChange(project)
    setQuery(project ?? '')
    setOpen(false)
    inputRef.current?.blur()
  }

  // Save whatever is in the input
  const commitQuery = () => {
    const trimmed = query.trim()
    if (trimmed) {
      if (trimmed !== (value ?? '')) onChange(trimmed)
    } else if (value) {
      onChange(null)
    }
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex((i) => Math.max(i - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          select(filtered[highlightIndex])
        } else {
          commitQuery()
        }
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setQuery(value ?? '')
        break
      case 'Tab':
        commitQuery()
        break
    }
  }

  const handleFocus = () => {
    setOpen(true)
    inputRef.current?.select()
  }

  const handleBlur = () => {
    // Small delay to allow click events on dropdown items to fire first
    setTimeout(() => {
      commitQuery()
    }, 150)
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Tempo"
          className={`w-full bg-surface-container rounded-lg px-3 py-2 text-on-surface text-sm outline-none placeholder:text-on-surface-variant/40 ${
            value ? 'pr-8' : ''
          }`}
        />
        {/* Clear button */}
        {value && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(null)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            aria-label="Clear project"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown — only shows existing projects as suggestions */}
      {open && filtered.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => commitQuery()} />
          <div className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 max-h-[200px] overflow-y-auto">
            {filtered.map((project, i) => (
              <button
                key={project}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(project)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  i === highlightIndex
                    ? 'bg-surface-container-low'
                    : value === project
                      ? 'text-primary font-medium bg-primary/5'
                      : 'text-on-surface hover:bg-surface-container-low'
                }`}
              >
                {project}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
