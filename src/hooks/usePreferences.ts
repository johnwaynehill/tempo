import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { UserPreferences } from '@/types'

const DEFAULT_PREFS: UserPreferences = {
  current_energy: undefined,
  theme: 'system',
  notifications_enabled: false,
}

export function usePreferences() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data, isLoading: loading } = useQuery({
    queryKey: ['preferences', user?.uid],
    queryFn: async () => {
      const result = await api.preferences.get() as Record<string, unknown>
      return {
        current_energy: result.current_energy ?? undefined,
        theme: (result.theme as string) ?? 'system',
        notifications_enabled: (result.notifications_enabled as boolean) ?? false,
      } as UserPreferences
    },
    enabled: !!user,
    staleTime: 60_000,
  })

  const preferences = data ?? DEFAULT_PREFS

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const merged = { ...preferences, ...updates }
    await api.preferences.update(merged as unknown as Record<string, unknown>)
    qc.invalidateQueries({ queryKey: ['preferences'] })
  }, [preferences])

  return { preferences, loading, updatePreferences }
}
