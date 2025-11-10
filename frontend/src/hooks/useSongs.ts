import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { Song } from '@/types/models';

/**
 * Fetch songs for a specific library
 */
export function useLibrarySongs(libraryId: string) {
  return useQuery({
    queryKey: ['library-songs', libraryId] as const,
    queryFn: () => apiClient.get<Song[]>(`/libraries/${libraryId}/songs`),
    enabled: !!libraryId,
    staleTime: 60000,
  });
}

/**
 * Fetch songs for a specific playlist
 */
export function usePlaylistSongs(playlistId: string) {
  return useQuery({
    queryKey: ['playlist-songs', playlistId] as const,
    queryFn: () => apiClient.get<Song[]>(`/playlists/${playlistId}/songs`),
    enabled: !!playlistId,
    staleTime: 60000,
  });
}

/**
 * Fetch a single song by ID
 */
export function useSong(id: string) {
  return useQuery({
    queryKey: ['song', id] as const,
    queryFn: () => apiClient.get<Song>(`/songs/${id}`),
    enabled: !!id,
    staleTime: 300000, // Song metadata is more stable, cache for 5 minutes
  });
}

/**
 * Upload a new song
 */
export function useUploadSong() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ libraryId, file }: { libraryId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('libraryId', libraryId);
      return apiClient.upload<Song>('/upload', formData);
    },
    onSuccess: (_, { libraryId }) => {
      // Invalidate library songs to refetch with new song
      queryClient.invalidateQueries({ queryKey: ['library-songs', libraryId] });
      queryClient.invalidateQueries({ queryKey: ['library', libraryId] });
    },
  });
}

/**
 * Update song metadata
 */
export function useUpdateSong() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; artist?: string; album?: string }) =>
      apiClient.patch<Song>(`/songs/${id}`, data),
    onSuccess: (updatedSong) => {
      // Update single song cache
      queryClient.setQueryData(['song', updatedSong.id], updatedSong);

      // Invalidate related lists
      queryClient.invalidateQueries({ queryKey: ['library-songs', updatedSong.libraryId] });
    },
  });
}

/**
 * Delete a song
 */
export function useDeleteSong() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/songs/${id}`),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: ['song', deletedId] });
      // Invalidate all library-songs queries (we don't know which library it belonged to)
      queryClient.invalidateQueries({ queryKey: ['library-songs'] });
    },
  });
}
