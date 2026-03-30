import { useState, useEffect } from 'react'

interface DeleteHabitConfirmProps {
  habitName: string
  onConfirm: () => void
  onClose: () => void
}

export function DeleteHabitConfirm({ habitName, onConfirm, onClose }: DeleteHabitConfirmProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

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

  const handleConfirm = () => {
    onConfirm()
    handleClose()
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" />

      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl p-6 transition-transform duration-200 ${
          visible ? 'translate-y-0' : 'translate-y-8'
        }`}
      >
        <h2 className="font-display text-lg font-semibold text-on-surface mb-2">
          Delete habit?
        </h2>
        <p className="text-on-surface-variant text-sm mb-6">
          This will permanently delete <span className="font-medium text-on-surface">{habitName}</span> and all its history. This can't be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-error text-on-error hover:shadow-md transition-all cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
