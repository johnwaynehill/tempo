import { useState } from 'react'
import { CaptureModal } from '@/components/ui/CaptureModal'

export function FAB() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-8 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-dim text-on-primary text-2xl font-light shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer flex items-center justify-center"
        aria-label="Quick capture"
      >
        +
      </button>

      {open && <CaptureModal onClose={() => setOpen(false)} />}
    </>
  )
}
