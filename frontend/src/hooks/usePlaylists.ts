import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import type { Playlist } from '@m3w/shared';

export const PLAYLISTS_QUERY_KEY = ['playlists'] as const;

/**
 * Fetch all playlists for the current user
 */
export function usePlaylists() {
  return useQuery({
    queryKey: PLAYLISTS_QUERY_KEY,
    queryFn: async () => {
      return await api.main.playlists.list();
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
      return await api.main.playlists.getById(id);
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
      return await api.main.playlists.create(data);
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
      return await api.main.playlists.update(id, data);
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
      await api.main.playlists.delete(id);
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
      api.main.playlists.addSong(playlistId, { songId }),
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
      api.main.playlists.removeSong(playlistId, songId),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
      // Invalidate playlists list to update song count on dashboard
      queryClient.invalidateQueries({ queryKey: PLAYLISTS_QUERY_KEY });
    },
  });
}
