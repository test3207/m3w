/**
 * Playlist Store
 * Manages playlists state with Zustand
 */

import { create } from 'zustand';
import { api } from '@/services';
import { logger } from '@/lib/logger-client';
import type { Playlist } from '@m3w/shared';

interface PlaylistState {
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  isLoading: boolean;
  error: string | null;
}

interface PlaylistActions {
  // Fetch operations
  fetchPlaylists: () => Promise<void>;
  setCurrentPlaylist: (playlist: Playlist | null) => void;
  
  // CRUD operations
  createPlaylist: (name: string) => Promise<Playlist | null>;
  deletePlaylist: (id: string) => Promise<boolean>;
  
  // Song management
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<boolean>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<boolean>;
  reorderPlaylistSongs: (playlistId: string, songIds: string[]) => Promise<boolean>;
  
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
};

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  ...initialState,

  // Fetch all playlists
  fetchPlaylists: async () => {
    console.log('[PlaylistStore] fetchPlaylists called');
    set({ isLoading: true, error: null });
    try {
      const playlists = await api.main.playlists.list();
      console.log('[PlaylistStore] Fetched playlists:', playlists.length);
      set({ playlists, isLoading: false });
      
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
      
      // Remove from list and clear current if it was deleted
      set((state) => ({
        playlists: state.playlists.filter((pl) => pl.id !== id),
        currentPlaylist: state.currentPlaylist?.id === id ? null : state.currentPlaylist,
        isLoading: false,
      }));
      
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
  addSongToPlaylist: async (playlistId: string, songId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.main.playlists.addSong(playlistId, { songId });
      
      // Update playlist songIds in state
      set((state) => ({
        playlists: state.playlists.map((pl) =>
          pl.id === playlistId
            ? { ...pl, songIds: [...pl.songIds, songId] }
            : pl
        ),
        isLoading: false,
      }));
      
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
      
      // Update playlist songIds in state
      set((state) => ({
        playlists: state.playlists.map((pl) =>
          pl.id === playlistId
            ? { ...pl, songIds: pl.songIds.filter((id) => id !== songId) }
            : pl
        ),
        isLoading: false,
      }));
      
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
      
      // Update playlist songIds in state
      set((state) => ({
        playlists: state.playlists.map((pl) =>
          pl.id === playlistId ? { ...pl, songIds } : pl
        ),
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

  // Get favorites playlist
  getFavoritesPlaylist: () => {
    const { playlists } = get();
    return playlists.find((pl) => pl.isDefault) || null;
  },

  // Check if playlist can be deleted
  canDeletePlaylist: (id: string) => {
    const { playlists } = get();
    const playlist = playlists.find((pl) => pl.id === id);
    return playlist?.canDelete ?? false;
  },

  // Reset store
  reset: () => {
    set(initialState);
  },
}));
