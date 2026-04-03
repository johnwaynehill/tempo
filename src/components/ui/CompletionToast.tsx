import { useEffect, useState } from 'react'

interface CompletionToastProps {
  message: string
  onDismiss: () => void
}

export function CompletionToast({ message, onDismiss }: CompletionToastProps) {
  const [visible, setVisible] = useState(false)

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // Animate out before dismiss
  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      className={`fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
      }`}
    >
      <button
        onClick={handleDismiss}
        className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-surface-container-lowest shadow-lg border border-outline-variant/15 cursor-pointer max-w-[90vw]"
      >
        {/* Sparkle icon */}
        <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M7 2C7 5.5 9 7.5 13 8C9 8.5 7 10.5 7 14C7 10.5 5 8.5 1 8C5 7.5 7 5.5 7 2Z" />
          <path d="M13 0C13 1.2 13.8 2 15 2C13.8 2 13 2.8 13 4C13 2.8 12.2 2 11 2C12.2 2 13 1.2 13 0Z" opacity="0.55" />
        </svg>
        <span className="text-sm text-on-surface font-medium">{message}</span>
      </button>
    </div>
  )
}
