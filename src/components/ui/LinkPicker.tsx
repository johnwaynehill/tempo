import { useState, useRef, useEffect } from 'react'

interface LinkPickerItem {
  id: string
  title: string
}

interface LinkPickerProps {
  items: LinkPickerItem[]
  onSelect: (id: string) => void
  onCreate: (title: string) => void
  onClose: () => void
  createLabel: string // e.g. "New note" or "New todo"
  placeholder: string // e.g. "Search notes..." or "Search todos..."
}

export function LinkPicker({
  items,
  onSelect,
  onCreate,
  onClose,
  createLabel,
  placeholder,
}: LinkPickerProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const filtered = query.trim()
    ? items.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()),
      )
    : items

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (filtered.length > 0) {
      onSelect(filtered[0].id)
    } else if (query.trim()) {
      onCreate(query.trim())
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full md:w-[420px] bg-surface-container-lowest rounded-t-2xl md:rounded-2xl shadow-xl max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <form onSubmit={handleSubmit} className="p-4 pb-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 outline-none text-sm"
          />
        </form>

        {/* Results */}
        <div className="overflow-y-auto px-2 pb-2 flex-1">
          {/* Create new option */}
          <button
            onClick={() => onCreate(query.trim() || '')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-surface-container-low transition-colors cursor-pointer flex items-center gap-2"
          >
            <span className="text-primary text-base">+</span>
            <span className="text-primary font-medium">
              {createLabel}{query.trim() ? `: ${query.trim()}` : ''}
            </span>
          </button>

          {/* Existing items */}
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              {item.title}
            </button>
          ))}

          {filtered.length === 0 && query.trim() && (
            <p className="px-3 py-2 text-xs text-on-surface-variant">
              No matches
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
