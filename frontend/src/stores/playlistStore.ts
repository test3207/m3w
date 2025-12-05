/**
 * Playlist Store
 * Manages playlists state with Zustand
 * 
 * Note: songIds are managed separately from Playlist type.
 * The Playlist type only has songCount for display.
 * We maintain a local cache of songIds for checking song membership.
 */

import { create } from 'zustand';
import { api } from '@/services';
import { logger } from '@/lib/logger-client';
import { isFavoritesPlaylist } from '@m3w/shared';
import type { Playlist } from '@m3w/shared';

interface PlaylistState {
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  isLoading: boolean;
  error: string | null;
  // Local cache of song IDs per playlist (for checking membership)
  playlistSongIds: Record<string, string[]>;
}

interface PlaylistActions {
  // Fetch operations
  fetchPlaylists: () => Promise<void>;
  setCurrentPlaylist: (playlist: Playlist | null) => void;

  // CRUD operations
  createPlaylist: (name: string) => Promise<Playlist | null>;
  deletePlaylist: (id: string) => Promise<boolean>;

  // Song management
  addSongToPlaylist: (playlistId: string, songId: string, songCoverUrl?: string | null) => Promise<boolean>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<boolean>;
  reorderPlaylistSongs: (playlistId: string, songIds: string[]) => Promise<boolean>;
  
  // Load song IDs for a playlist (for membership check)
  loadPlaylistSongIds: (playlistId: string) => Promise<string[]>;
  getPlaylistSongIds: (playlistId: string) => string[];
  isInPlaylist: (playlistId: string, songId: string) => boolean;

  // Favorites
  isSongFavorited: (songId: string) => boolean;
  toggleFavorite: (songId: string, songCoverUrl?: string | null) => Promise<boolean>;

  // Computed getters
  getFavoritesPlaylist: () => Playlist | null;
  canDeletePlaylist: (id: string) => boolean;

  // Reset
  reset: () => void;
}

type PlaylistStore = PlaylistState & PlaylistActions;

const initialState: PlaylistState = {
  playlists: [],
  currentPlaylist: null,
  isLoading: false,
  error: null,
  playlistSongIds: {},
};

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  ...initialState,

  // Fetch all playlists
  fetchPlaylists: async () => {
    set({ isLoading: true, error: null });
    try {
      const playlists = await api.main.playlists.list();
      set({ playlists, isLoading: false });
      
      // Auto-load favorites songIds for isSongFavorited() to work correctly
      const favorites = playlists.find((pl) => isFavoritesPlaylist(pl));
      if (favorites) {
        const songs = await api.main.playlists.getSongs(favorites.id);
        set((state) => ({
          playlistSongIds: {
            ...state.playlistSongIds,
            [favorites.id]: songs.map(s => s.id),
          },
        }));
      }

      logger.info(`Fetched ${playlists.length} playlists`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch playlists';
      logger.error('Failed to fetch playlists', { error });
      set({ error: errorMessage, isLoading: false });
    }
  },

  // Set current playlist
  setCurrentPlaylist: (playlist) => {
    set({ currentPlaylist: playlist });
  },

  // Create new playlist
  createPlaylist: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const newPlaylist = await api.main.playlists.create({ name });

      // Add to list and set as current
      set((state) => ({
        playlists: [...state.playlists, newPlaylist],
        currentPlaylist: newPlaylist,
        isLoading: false,
        // Initialize empty songIds for new playlist
        playlistSongIds: {
          ...state.playlistSongIds,
          [newPlaylist.id]: [],
        },
      }));

      logger.info(`Created playlist: ${name}`, { playlistId: newPlaylist.id });
      return newPlaylist;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create playlist';
      logger.error('Failed to create playlist', { error, name });
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  // Delete playlist
  deletePlaylist: async (id: string) => {
    const { canDeletePlaylist } = get();

    // Check if playlist can be deleted
    if (!canDeletePlaylist(id)) {
      logger.warn('Cannot delete default playlist', { playlistId: id });
      set({ error: 'Cannot delete favorites playlist' });
      return false;
    }

    set({ isLoading: true, error: null });
    try {
      await api.main.playlists.delete(id);

      // Remove from list, clear current if deleted, and clean up songIds cache
      set((state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _removed, ...remainingSongIds } = state.playlistSongIds;
        return {
          playlists: state.playlists.filter((pl) => pl.id !== id),
          currentPlaylist: state.currentPlaylist?.id === id ? null : state.currentPlaylist,
          isLoading: false,
          playlistSongIds: remainingSongIds,
        };
      });

      logger.info(`Deleted playlist`, { playlistId: id });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete playlist';
      logger.error('Failed to delete playlist', { error, playlistId: id });
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  // Add song to playlist
  addSongToPlaylist: async (playlistId: string, songId: string, songCoverUrl?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await api.main.playlists.addSong(playlistId, { songId });

      // Update playlist songCount and local songIds cache
      set((state) => {
        const currentSongIds = state.playlistSongIds[playlistId] || [];
        const wasEmpty = currentSongIds.length === 0;
        
        return {
          playlists: state.playlists.map((pl) => {
            if (pl.id !== playlistId) return pl;
            return {
              ...pl,
              songCount: pl.songCount + 1,
              // Update coverUrl if playlist was empty and we have a cover
              coverUrl: wasEmpty && songCoverUrl ? songCoverUrl : pl.coverUrl,
            };
          }),
          playlistSongIds: {
            ...state.playlistSongIds,
            [playlistId]: [...currentSongIds, songId],
          },
          isLoading: false,
        };
      });

      logger.info('Added song to playlist', { playlistId, songId });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add song';
      logger.error('Failed to add song to playlist', { error, playlistId, songId });
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  // Remove song from playlist
  removeSongFromPlaylist: async (playlistId: string, songId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.main.playlists.removeSong(playlistId, songId);

      // Update playlist songCount and local songIds cache
      set((state) => {
        const currentSongIds = state.playlistSongIds[playlistId] || [];
        
        return {
          playlists: state.playlists.map((pl) =>
            pl.id === playlistId
              ? { ...pl, songCount: Math.max(0, pl.songCount - 1) }
              : pl
          ),
          playlistSongIds: {
            ...state.playlistSongIds,
            [playlistId]: currentSongIds.filter((id) => id !== songId),
          },
          isLoading: false,
        };
      });

      logger.info('Removed song from playlist', { playlistId, songId });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove song';
      logger.error('Failed to remove song from playlist', { error, playlistId, songId });
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  // Reorder playlist songs
  reorderPlaylistSongs: async (playlistId: string, songIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await api.main.playlists.reorderSongs(playlistId, { songIds });

      // Update local songIds cache with new order
      set((state) => ({
        playlistSongIds: {
          ...state.playlistSongIds,
          [playlistId]: songIds,
        },
        isLoading: false,
      }));

      logger.info('Reordered playlist songs', { playlistId, songCount: songIds.length });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder songs';
      logger.error('Failed to reorder playlist songs', { error, playlistId });
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  // Load song IDs for a playlist from API
  loadPlaylistSongIds: async (playlistId: string) => {
    try {
      const songs = await api.main.playlists.getSongs(playlistId);
      const songIds = songs.map(s => s.id);
      
      set((state) => ({
        playlistSongIds: {
          ...state.playlistSongIds,
          [playlistId]: songIds,
        },
      }));
      
      return songIds;
    } catch (error) {
      logger.error('Failed to load playlist songs', { error, playlistId });
      return [];
    }
  },

  // Get cached song IDs for a playlist
  getPlaylistSongIds: (playlistId: string) => {
    const { playlistSongIds } = get();
    return playlistSongIds[playlistId] || [];
  },

  // Check if a song is in a playlist
  isInPlaylist: (playlistId: string, songId: string) => {
    const { getPlaylistSongIds } = get();
    return getPlaylistSongIds(playlistId).includes(songId);
  },

  // Get favorites playlist (check isDefault flag)
  getFavoritesPlaylist: () => {
    const { playlists } = get();
    return playlists.find((pl) => isFavoritesPlaylist(pl)) || null;
  },

  // Check if a song is in favorites playlist
  isSongFavorited: (songId: string) => {
    const { getFavoritesPlaylist, isInPlaylist } = get();
    const favorites = getFavoritesPlaylist();
    if (!favorites) return false;
    return isInPlaylist(favorites.id, songId);
  },

  // Toggle song favorite status (add/remove from favorites playlist)
  toggleFavorite: async (songId: string, songCoverUrl?: string | null) => {
    const { getFavoritesPlaylist, addSongToPlaylist, removeSongFromPlaylist, isSongFavorited } = get();
    
    const favorites = getFavoritesPlaylist();
    
    if (!favorites) {
      logger.error('Favorites playlist not found');
      return false;
    }

    const isCurrentlyFavorited = isSongFavorited(songId);
    
    if (isCurrentlyFavorited) {
      return await removeSongFromPlaylist(favorites.id, songId);
    } else {
      return await addSongToPlaylist(favorites.id, songId, songCoverUrl);
    }
  },

  // Check if playlist can be deleted (check isDefault flag)
  canDeletePlaylist: (id: string) => {
    const { playlists } = get();
    const playlist = playlists.find((pl) => pl.id === id);
    if (!playlist) return false;
    // Favorites playlist cannot be deleted
    if (isFavoritesPlaylist(playlist)) return false;
    return playlist.canDelete ?? false;
  },

  // Reset store
  reset: () => {
    set(initialState);
  },
}));
