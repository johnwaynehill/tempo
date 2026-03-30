import { useState, useEffect, useRef } from 'react'

interface AddHabitModalProps {
  onSave: (name: string, description?: string) => void
  onClose: () => void
  initialName?: string
  initialDescription?: string
  title?: string
}

export function AddHabitModal({
  onSave,
  onClose,
  initialName = '',
  initialDescription = '',
  title = 'New Habit',
}: AddHabitModalProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [visible, setVisible] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    nameRef.current?.focus()
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
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed, description.trim() || undefined)
    handleClose()
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />

      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full sm:max-w-md bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl shadow-xl p-6 transition-transform duration-200 ${
          visible ? 'translate-y-0' : 'translate-y-8'
        }`}
      >
        <h2 className="font-display text-lg font-semibold text-on-surface mb-5">
          {title}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-on-surface-variant text-xs font-medium block mb-1.5">
              Name
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Meditate, Exercise, Read..."
              className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm outline-none placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-on-surface-variant text-xs font-medium block mb-1.5">
              Description
              <span className="text-on-surface-variant/50 ml-1">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why this habit matters to you..."
              rows={2}
              className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm outline-none resize-none placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Frequency (read-only for v1) */}
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant text-xs font-medium">Frequency</span>
            <span className="text-on-surface text-xs bg-surface-container px-3 py-1.5 rounded-lg">
              Daily
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary text-on-primary hover:shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
