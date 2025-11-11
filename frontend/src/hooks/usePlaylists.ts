import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/api-config';
import type { Playlist, ApiResponse } from '@m3w/shared';

export const PLAYLISTS_QUERY_KEY = ['playlists'] as const;

/**
 * Fetch all playlists for the current user
 */
export function usePlaylists() {
  return useQuery({
    queryKey: PLAYLISTS_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Playlist[]>>(API_ENDPOINTS.playlists.list);
      return response.data ?? [];
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
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Playlist>>(API_ENDPOINTS.playlists.detail(id));
      return response.data;
    },
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
    mutationFn: async (data: { name: string; description?: string; cover?: string }) => {
      const response = await apiClient.post<ApiResponse<Playlist>>(API_ENDPOINTS.playlists.create, data);
      return response.data!;
    },
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
    mutationFn: async ({ id, ...data }: { id: string; name: string; description?: string; cover?: string }) => {
      const response = await apiClient.put<ApiResponse<Playlist>>(API_ENDPOINTS.playlists.update(id), data);
      return response.data!;
    },
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
    mutationFn: async (id: string) => {
      await apiClient.delete<ApiResponse<void>>(API_ENDPOINTS.playlists.delete(id));
      return id;
    },
    onSuccess: (deletedId) => {
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
      apiClient.post<ApiResponse<void>>(API_ENDPOINTS.playlists.addSong(playlistId), { songId }),
    onSuccess: (_, { playlistId }) => {
      // Invalidate playlist to refetch with new song
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
      // Invalidate playlists list to update song count on dashboard
      queryClient.invalidateQueries({ queryKey: PLAYLISTS_QUERY_KEY });
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
      apiClient.delete<ApiResponse<void>>(API_ENDPOINTS.playlists.removeSong(playlistId, songId)),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
      // Invalidate playlists list to update song count on dashboard
      queryClient.invalidateQueries({ queryKey: PLAYLISTS_QUERY_KEY });
    },
  });
}
