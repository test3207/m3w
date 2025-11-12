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
  AddSongToPlaylistInput 
} from '@m3w/shared';

// Re-export shared types for convenience
export type { CreatePlaylistInput, UpdatePlaylistInput, AddSongToPlaylistInput };

export interface ReorderSongInput {
  songId: string;
  direction: 'up' | 'down';
}

export const playlists = {
  /**
   * List all playlists
   */
  list: async (): Promise<Playlist[]> => {
    return mainApiClient.get<Playlist[]>(MAIN_API_ENDPOINTS.playlists.list);
  },

  /**
   * Get playlist by ID
   */
  getById: async (id: string): Promise<Playlist> => {
    return mainApiClient.get<Playlist>(MAIN_API_ENDPOINTS.playlists.detail(id));
  },

  /**
   * Get songs in playlist
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
   */
  reorderSong: async (id: string, data: ReorderSongInput): Promise<void> => {
    return mainApiClient.post(MAIN_API_ENDPOINTS.playlists.reorderSongs(id), data);
  },
};
