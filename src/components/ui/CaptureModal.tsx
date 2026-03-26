import { useState, useRef, useEffect } from 'react'

type CaptureType = 'todo' | 'note'

interface CaptureModalProps {
  onClose: () => void
}

export function CaptureModal({ onClose }: CaptureModalProps) {
  const [type, setType] = useState<CaptureType>('todo')
  const [title, setTitle] = useState('')
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    // TODO: Write to Firestore (inbox for todos, notes collection for notes)
    console.log('Captured:', { type, title: title.trim() })

    onClose()
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
        className="relative w-full md:w-[480px] bg-surface-container-lowest rounded-t-2xl md:rounded-2xl p-6 pb-8 md:pb-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Type Toggle */}
        <div className="flex gap-2 mb-4">
          {(['todo', 'note'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer ${
                type === t
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {t === 'todo' ? 'Todo' : 'Note'}
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'todo' ? 'What needs doing?' : 'Note title...'}
            className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 outline-none text-base"
          />

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-br from-primary to-primary-dim text-on-primary text-sm font-medium disabled:opacity-40 transition-all duration-200 hover:shadow-md cursor-pointer"
            >
              Capture
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
