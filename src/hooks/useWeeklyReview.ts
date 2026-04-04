import { useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { WeeklyReview } from '@/types'

interface UseWeeklyReviewResult {
  review: WeeklyReview | null
  loading: boolean
  saveReflection: (text: string) => void
}

export function useWeeklyReview(weekId: string): UseWeeklyReviewResult {
  const { user } = useAuth()
  const qc = useQueryClient()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const { data: review = null, isLoading: loading } = useQuery({
    queryKey: ['review', user?.uid, weekId],
    queryFn: async () => {
      try {
        return await api.reviews.get(weekId) as unknown as WeeklyReview
      } catch {
        return null
      }
    },
    enabled: !!user && !!weekId,
    staleTime: 30_000,
  })

  const saveReflection = useCallback(
    (text: string) => {
      if (!user || !weekId) return

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

      saveTimerRef.current = setTimeout(() => {
        api.reviews.save(weekId, { reflection: text }).then(() => {
          qc.invalidateQueries({ queryKey: ['review', user.uid, weekId] })
        })
      }, 500)
    },
    [user, weekId],
  )

  return { review, loading, saveReflection }
}
