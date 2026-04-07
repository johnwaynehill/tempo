import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Playlist, PlaylistItem } from '@/types'

export interface CreatePlaylistInput {
  name: string
  description?: string
  items?: Omit<PlaylistItem, 'id' | 'playlist_id'>[]
}

export function usePlaylists() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: playlists = [], isLoading: loading } = useQuery({
    queryKey: ['playlists', user?.uid],
    queryFn: () => api.playlists.list() as Promise<Playlist[]>,
    enabled: !!user,
    staleTime: 30_000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['playlists'] })
  }

  const addPlaylist = useCallback(async (input: CreatePlaylistInput): Promise<string> => {
    const result = await api.playlists.create(input as unknown as Record<string, unknown>)
    invalidate()
    return (result as unknown as Playlist).id
  }, [])

  const updatePlaylist = useCallback(async (id: string, data: Partial<Playlist> & { items?: Omit<PlaylistItem, 'id' | 'playlist_id'>[] }) => {
    await api.playlists.update(id, data as unknown as Record<string, unknown>)
    invalidate()
  }, [])

  const deletePlaylist = useCallback(async (id: string) => {
    await api.playlists.delete(id)
    invalidate()
  }, [])

  const startPlaylist = useCallback(async (id: string): Promise<number> => {
    const result = await api.playlists.start(id)
    qc.invalidateQueries({ queryKey: ['todos'] })
    qc.invalidateQueries({ queryKey: ['today-set'] })
    return result.count
  }, [])

  return { playlists, loading, addPlaylist, updatePlaylist, deletePlaylist, startPlaylist }
}
