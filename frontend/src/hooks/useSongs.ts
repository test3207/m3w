import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api-config';
import type { Song, ApiResponse } from '@m3w/shared';

/**
 * Fetch songs for a specific library
 */
export function useLibrarySongs(libraryId: string) {
  return useQuery({
    queryKey: ['library-songs', libraryId] as const,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Song[]>>(API_ENDPOINTS.libraries.songs(libraryId));
      return response.data ?? [];
    },
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
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Song[]>>(API_ENDPOINTS.playlists.songs(playlistId));
      return response.data ?? [];
    },
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
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Song>>(API_ENDPOINTS.songs.detail(id));
      return response.data;
    },
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
    mutationFn: async ({ libraryId, file }: { libraryId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('libraryId', libraryId);
      const response = await apiClient.upload<ApiResponse<Song>>(API_ENDPOINTS.upload.file, formData);
      return response.data!;
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
    mutationFn: async ({ id, ...data }: { id: string; title?: string; artist?: string; album?: string }) => {
      const response = await apiClient.patch<ApiResponse<Song>>(API_ENDPOINTS.songs.update(id), data);
      return response.data!;
    },
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
    mutationFn: async (id: string) => {
      await apiClient.delete<ApiResponse<void>>(API_ENDPOINTS.songs.delete(id));
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.removeQueries({ queryKey: ['song', deletedId] });
      // Invalidate all library-songs queries (we don't know which library it belonged to)
      queryClient.invalidateQueries({ queryKey: ['library-songs'] });
    },
  });
}
