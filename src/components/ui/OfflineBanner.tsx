import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const online = useOnlineStatus()
  const [showReconnected, setShowReconnected] = useState(false)
  // Flash "reconnected" when we come back online; going offline hides it.
  const [prevOnline, setPrevOnline] = useState(online)
  if (online !== prevOnline) {
    setPrevOnline(online)
    setShowReconnected(online)
  }

  useEffect(() => {
    if (!showReconnected) return
    const timer = setTimeout(() => setShowReconnected(false), 3000)
    return () => clearTimeout(timer)
  }, [showReconnected])

  if (!online) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-on-surface-variant text-surface text-xs text-center py-2 px-4 font-medium animate-slide-down">
        You're offline — changes saved locally and will sync when you reconnect
      </div>
    )
  }

  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-on-primary text-xs text-center py-2 px-4 font-medium animate-slide-down">
        Back online — syncing...
      </div>
    )
  }

  return null
}
