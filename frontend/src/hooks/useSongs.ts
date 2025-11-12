import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import { calculateFileHash } from '@/lib/utils/hash';

/**
 * Fetch songs for a specific library
 */
export function useLibrarySongs(libraryId: string) {
  return useQuery({
    queryKey: ['library-songs', libraryId] as const,
    queryFn: async () => {
      return await api.main.libraries.getSongs(libraryId);
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
      return await api.main.playlists.getSongs(playlistId);
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
      return await api.main.songs.getById(id);
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
      const hash = await calculateFileHash(file);
      return await api.main.upload.uploadFile(libraryId, file, hash);
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
      return await api.main.songs.update(id, data);
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
      await api.main.songs.delete(id);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.removeQueries({ queryKey: ['song', deletedId] });
      // Invalidate all library-songs queries (we don't know which library it belonged to)
      queryClient.invalidateQueries({ queryKey: ['library-songs'] });
    },
  });
}
