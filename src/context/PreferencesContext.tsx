import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { preferencesConverter } from '@/lib/converters'
import type { UserPreferences } from '@/types'

const DEFAULT_PREFS: UserPreferences = {
  current_energy: undefined,
  theme: 'system',
  notifications_enabled: false,
}

interface PreferencesContextValue {
  preferences: UserPreferences
  loading: boolean
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
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

  return (
    <PreferencesContext.Provider value={{ preferences, loading, updatePreferences }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferencesContext() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferencesContext must be used within PreferencesProvider')
  return ctx
}
