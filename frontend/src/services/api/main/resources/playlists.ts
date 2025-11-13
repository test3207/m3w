/**
 * Playlists Resource Service
 */

import { mainApiClient } from '../client';
import { MAIN_API_ENDPOINTS } from '../endpoints';
import type {
  Playlist,
  Song,
  CreatePlaylistInput,
  UpdatePlaylistInput,
  AddSongToPlaylistInput,
  ReorderPlaylistSongsInput
} from '@m3w/shared';

// Re-export shared types for convenience
export type { CreatePlaylistInput, UpdatePlaylistInput, AddSongToPlaylistInput, ReorderPlaylistSongsInput };

export const playlists = {
  /**
   * List all playlists
   * Returns playlists with new fields: coverUrl, isDefault, canDelete, songIds
   */
  list: async (): Promise<Playlist[]> => {
    return mainApiClient.get<Playlist[]>(MAIN_API_ENDPOINTS.playlists.list);
  },

  /**
   * Get playlist by ID with songs
   * Returns playlist with songs array in songIds order
   */
  getById: async (id: string): Promise<Playlist & { songs?: Song[] }> => {
    return mainApiClient.get<Playlist & { songs?: Song[] }>(MAIN_API_ENDPOINTS.playlists.detail(id));
  },

  /**
   * Get songs in playlist (in user-defined order)
   * Songs are ordered by the songIds array
   */
  getSongs: async (id: string): Promise<Song[]> => {
    return mainApiClient.get<Song[]>(MAIN_API_ENDPOINTS.playlists.songs(id));
  },

  /**
   * Create new playlist
   */
  create: async (data: CreatePlaylistInput): Promise<Playlist> => {
    return mainApiClient.post<Playlist>(MAIN_API_ENDPOINTS.playlists.create, data);
  },

  /**
   * Update playlist
   */
  update: async (id: string, data: UpdatePlaylistInput): Promise<Playlist> => {
    return mainApiClient.patch<Playlist>(MAIN_API_ENDPOINTS.playlists.update(id), data);
  },

  /**
   * Delete playlist
   * Note: Cannot delete default playlist (canDelete === false)
   */
  delete: async (id: string): Promise<void> => {
    return mainApiClient.delete(MAIN_API_ENDPOINTS.playlists.delete(id));
  },

  /**
   * Add song to playlist
   */
  addSong: async (id: string, data: AddSongToPlaylistInput): Promise<void> => {
    return mainApiClient.post(MAIN_API_ENDPOINTS.playlists.addSong(id), data);
  },

  /**
   * Remove song from playlist
   */
  removeSong: async (playlistId: string, songId: string): Promise<void> => {
    return mainApiClient.delete(MAIN_API_ENDPOINTS.playlists.removeSong(playlistId, songId));
  },

  /**
   * Reorder songs in playlist
   * Replaces entire songIds array with new order
   * @param id - Playlist ID
   * @param data - { songIds: string[] } - Complete array in new order
   */
  reorderSongs: async (id: string, data: ReorderPlaylistSongsInput): Promise<void> => {
    return mainApiClient.put(MAIN_API_ENDPOINTS.playlists.reorderSongs(id), data);
  },

  /**
   * Get playlist linked to a library (for "Play All" functionality)
   * @param libraryId - Library ID
   * @returns Playlist if exists, null otherwise
   */
  getByLibrary: async (libraryId: string): Promise<Playlist | null> => {
    try {
      return await mainApiClient.get<Playlist>(`/api/playlists/by-library/${libraryId}`);
    } catch {
      // Return null if not found (404)
      return null;
    }
  },

  /**
   * Create playlist linked to a library
   * @param data - { name, linkedLibraryId, songIds }
   */
  createForLibrary: async (data: { name: string; linkedLibraryId: string; songIds: string[] }): Promise<Playlist> => {
    return mainApiClient.post<Playlist>('/api/playlists/for-library', data);
  },

  /**
   * Update playlist songs (batch update songIds)
   * @param id - Playlist ID
   * @param data - { songIds: string[] }
   */
  updateSongs: async (id: string, data: { songIds: string[] }): Promise<void> => {
    return mainApiClient.put(`/api/playlists/${id}/songs`, data);
  },
};
