import { useState, useEffect, useCallback } from 'react'

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

/**
 * Hook for managing Web Notification API permission.
 * Returns the current permission state and a function to request permission.
 */
export function useNotifications() {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission as PermissionState
  })

  // Sync if permission changes externally
  useEffect(() => {
    if (typeof Notification === 'undefined') return

    // The permissions API lets us watch for changes
    navigator.permissions?.query({ name: 'notifications' }).then((status) => {
      const update = () => setPermission(status.state === 'prompt' ? 'default' : status.state as PermissionState)
      status.addEventListener('change', update)
      return () => status.removeEventListener('change', update)
    })
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported' as const

    const result = await Notification.requestPermission()
    setPermission(result as PermissionState)
    return result as PermissionState
  }, [])

  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (permission !== 'granted') return null
      return new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      })
    },
    [permission],
  )

  return {
    permission,
    isSupported: permission !== 'unsupported',
    isGranted: permission === 'granted',
    requestPermission,
    sendNotification,
  }
}
