import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Check for updates every 60 minutes
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      }
    },
  })

  if (!needRefresh) return null

  const handleUpdate = async () => {
    try {
      await updateServiceWorker(true)
    } catch {
      // Fallback: if SW update fails, force reload
      window.location.reload()
    }
    // Safety net: if updateServiceWorker didn't trigger a reload, force one
    setTimeout(() => window.location.reload(), 1000)
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/20 px-5 py-3 flex items-center gap-4">
        <p className="text-on-surface text-sm">
          New version available
        </p>
        <button
          onClick={handleUpdate}
          className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-medium hover:bg-primary-dim transition-colors duration-200 cursor-pointer whitespace-nowrap"
        >
          Update
        </button>
      </div>
    </div>
  )
}
