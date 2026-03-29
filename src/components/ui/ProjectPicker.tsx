import { useState, useRef, useEffect, useMemo } from 'react'

interface ProjectPickerProps {
  value: string | null
  projects: string[]
  onChange: (project: string | null) => void
}

export function ProjectPicker({ value, projects, onChange }: ProjectPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value ?? '')
  const [highlightIndex, setHighlightIndex] = useState(0)
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

  const exactMatch = projects.some(
    (p) => p.toLowerCase() === query.trim().toLowerCase(),
  )
  const showCreate = query.trim().length > 0 && !exactMatch

  // Build the selectable options list
  const options: { type: 'create' | 'existing'; label: string }[] = []
  if (showCreate) options.push({ type: 'create', label: query.trim() })
  for (const p of filtered) options.push({ type: 'existing', label: p })

  // Reset highlight when options change
  useEffect(() => {
    setHighlightIndex(0)
  }, [filtered.length, showCreate])

  const select = (project: string | null) => {
    onChange(project)
    setQuery(project ?? '')
    setOpen(false)
    inputRef.current?.blur()
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
        setHighlightIndex((i) => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (options.length > 0) {
          const opt = options[highlightIndex]
          select(opt.label)
        } else if (query.trim()) {
          select(query.trim())
        }
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setQuery(value ?? '')
        break
      case 'Tab':
        setOpen(false)
        if (query.trim() && query.trim() !== (value ?? '')) {
          select(query.trim() || null)
        }
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
      if (!open) return
      setOpen(false)
      setQuery(value ?? '')
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

      {/* Dropdown */}
      {open && options.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => { setOpen(false); setQuery(value ?? '') }} />
          <div className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 max-h-[200px] overflow-y-auto">
            {options.map((option, i) => (
              <button
                key={`${option.type}-${option.label}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(option.label)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center gap-2 ${
                  i === highlightIndex
                    ? 'bg-surface-container-low'
                    : ''
                } ${
                  option.type === 'create'
                    ? 'text-primary font-medium'
                    : value === option.label
                      ? 'text-primary font-medium bg-primary/5'
                      : 'text-on-surface hover:bg-surface-container-low'
                }`}
              >
                {option.type === 'create' && (
                  <span className="text-primary text-base leading-none">+</span>
                )}
                {option.type === 'create' ? `Create "${option.label}"` : option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
