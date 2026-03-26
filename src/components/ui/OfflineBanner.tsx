import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const online = useOnlineStatus()
  const [showReconnected, setShowReconnected] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    if (!online) {
      setWasOffline(true)
    } else if (wasOffline) {
      // Just came back online — flash a "reconnected" message
      setShowReconnected(true)
      const timer = setTimeout(() => {
        setShowReconnected(false)
        setWasOffline(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [online, wasOffline])

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
