import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { Playlist } from '@/types/models';

export const PLAYLISTS_QUERY_KEY = ['playlists'] as const;

/**
 * Fetch all playlists for the current user
 */
export function usePlaylists() {
  return useQuery({
    queryKey: PLAYLISTS_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Playlist[] }>('/playlists');
      return response.data; // Extract data array from response wrapper
    },
    staleTime: 60000,
    gcTime: 300000,
  });
}

/**
 * Fetch a single playlist by ID
 */
export function usePlaylist(id: string) {
  return useQuery({
    queryKey: ['playlist', id] as const,
    queryFn: () => apiClient.get<Playlist>(`/playlists/${id}`),
    enabled: !!id,
    staleTime: 60000,
  });
}

/**
 * Create a new playlist
 */
export function useCreatePlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string; cover?: string }) =>
      apiClient.post<Playlist>('/playlists', data),
    onSuccess: (newPlaylist) => {
      queryClient.setQueryData<Playlist[]>(PLAYLISTS_QUERY_KEY, (old = []) => [
        ...old,
        newPlaylist,
      ]);
    },
  });
}

/**
 * Update an existing playlist
 */
export function useUpdatePlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; description?: string; cover?: string }) =>
      apiClient.put<Playlist>(`/playlists/${id}`, data),
    onSuccess: (updatedPlaylist) => {
      queryClient.setQueryData(['playlist', updatedPlaylist.id], updatedPlaylist);
      queryClient.setQueryData<Playlist[]>(PLAYLISTS_QUERY_KEY, (old = []) =>
        old.map((pl) => (pl.id === updatedPlaylist.id ? updatedPlaylist : pl))
      );
    },
  });
}

/**
 * Delete a playlist
 */
export function useDeletePlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/playlists/${id}`),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: ['playlist', deletedId] });
      queryClient.setQueryData<Playlist[]>(PLAYLISTS_QUERY_KEY, (old = []) =>
        old.filter((pl) => pl.id !== deletedId)
      );
    },
  });
}

/**
 * Add a song to a playlist
 */
export function useAddSongToPlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: string; songId: string }) =>
      apiClient.post(`/playlists/${playlistId}/songs`, { songId }),
    onSuccess: (_, { playlistId }) => {
      // Invalidate playlist to refetch with new song
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    },
  });
}

/**
 * Remove a song from a playlist
 */
export function useRemoveSongFromPlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: string; songId: string }) =>
      apiClient.delete(`/playlists/${playlistId}/songs/${songId}`),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    },
  });
}
