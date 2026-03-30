import { useEffect, useState, useRef, useCallback } from 'react'
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { reviewConverter } from '@/lib/converters'
import type { WeeklyReview } from '@/types'

interface UseWeeklyReviewResult {
  review: WeeklyReview | null
  loading: boolean
  saveReflection: (text: string) => void
}

export function useWeeklyReview(weekId: string): UseWeeklyReviewResult {
  const { user } = useAuth()
  const [review, setReview] = useState<WeeklyReview | null>(null)
  const [loading, setLoading] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Subscribe to the review document
  useEffect(() => {
    if (!user || !weekId) {
      setReview(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const ref = doc(db, 'users', user.uid, 'reviews', weekId).withConverter(reviewConverter)

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        setReview(snapshot.data())
      } else {
        setReview(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [user, weekId])

  // Debounced save
  const saveReflection = useCallback(
    (text: string) => {
      if (!user || !weekId) return

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

      saveTimerRef.current = setTimeout(() => {
        const now = new Date()
        const ref = doc(db, 'users', user.uid, 'reviews', weekId)
        setDoc(ref, {
          reflection: text,
          created_at: review?.created_at ? Timestamp.fromDate(review.created_at) : Timestamp.fromDate(now),
          updated_at: Timestamp.fromDate(now),
        })
      }, 500)
    },
    [user, weekId, review?.created_at],
  )

  return { review, loading, saveReflection }
}
