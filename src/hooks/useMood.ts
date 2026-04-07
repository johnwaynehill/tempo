import { useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { MoodEntry } from '@/types'

export function useMood() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: latestMood, isLoading: loading } = useQuery({
    queryKey: ['mood-latest', user?.uid],
    queryFn: () => api.mood.latest() as Promise<MoodEntry | null>,
    enabled: !!user,
    staleTime: 30_000,
  })

  const { data: history } = useQuery({
    queryKey: ['mood-history', user?.uid],
    queryFn: () => api.mood.history(14) as Promise<MoodEntry[]>,
    enabled: !!user,
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: (data: { value: number; note?: string }) => api.mood.log(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mood-latest'] })
      qc.invalidateQueries({ queryKey: ['mood-history'] })
      qc.invalidateQueries({ queryKey: ['habits'] })
    },
  })

  const logMood = useCallback((value: number, note?: string) => {
    mutation.mutate({ value, note })
  }, [mutation])

  return {
    latestMood: latestMood ?? null,
    history: history ?? [],
    logMood,
    loading,
    logging: mutation.isPending,
  }
}
