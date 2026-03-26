import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { preferencesConverter } from '@/lib/converters'
import type { UserPreferences } from '@/types'

const DEFAULT_PREFS: UserPreferences = {
  current_energy: undefined,
  theme: 'light',
  notifications_enabled: false,
}

export function usePreferences() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setPreferences(DEFAULT_PREFS)
      setLoading(false)
      return
    }

    const ref = doc(db, 'users', user.uid, 'settings', 'preferences').withConverter(
      preferencesConverter,
    )

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        setPreferences(snapshot.data())
      } else {
        setPreferences(DEFAULT_PREFS)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user) throw new Error('Not authenticated')

    const ref = doc(db, 'users', user.uid, 'settings', 'preferences')
    const merged = { ...preferences, ...updates }

    await setDoc(ref, {
      current_energy: merged.current_energy ?? null,
      theme: merged.theme,
      notifications_enabled: merged.notifications_enabled,
    })
  }

  return {
    preferences,
    loading,
    updatePreferences,
  }
}
