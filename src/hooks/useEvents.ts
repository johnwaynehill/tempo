import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { CalendarEvent } from '@/types'

export interface AddEventInput {
  title: string
  start_time: Date
  end_time: Date
  all_day?: boolean
  description?: string
  location?: string
  color?: CalendarEvent['color']
}

export function useEvents() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: events = [], isLoading: loading } = useQuery({
    queryKey: ['events', user?.uid],
    queryFn: () => api.events.list() as Promise<CalendarEvent[]>,
    enabled: !!user,
    staleTime: 30_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['events'] })

  const addEvent = useCallback(async (input: AddEventInput): Promise<string> => {
    const id = uuid()
    await api.events.create({
      id, title: input.title, start_time: input.start_time, end_time: input.end_time,
      all_day: input.all_day ?? false, description: input.description,
      location: input.location, color: input.color,
    } as unknown as Record<string, unknown>)
    await invalidate()
    return id
  }, [])

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    const data: Record<string, unknown> = { ...updates }
    for (const key of Object.keys(data)) {
      if (data[key] === undefined) data[key] = null
    }
    await api.events.update(id, data)
    await invalidate()
  }, [])

  const removeEvent = useCallback(async (id: string) => {
    await api.events.delete(id)
    await invalidate()
  }, [])

  return { events, loading, addEvent, updateEvent, removeEvent }
}
