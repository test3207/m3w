/**
 * Songs Resource Service
 */

import { mainApiClient } from '../client';
import { MAIN_API_ENDPOINTS } from '../endpoints';
import type { Song } from '@/types/models';

export interface UpdateSongInput {
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
}

export interface PlaylistCountResponse {
  count: number;
}

export const songs = {
  /**
   * Get song by ID
   */
  getById: async (id: string): Promise<Song> => {
    return mainApiClient.get<Song>(MAIN_API_ENDPOINTS.songs.detail(id));
  },

  /**
   * Update song metadata
   */
  update: async (id: string, data: UpdateSongInput): Promise<Song> => {
    return mainApiClient.patch<Song>(MAIN_API_ENDPOINTS.songs.update(id), data);
  },

  /**
   * Get song stream URL
   */
  getStreamUrl: (id: string): string => {
    return MAIN_API_ENDPOINTS.songs.stream(id);
  },

  /**
   * Get playlist count for song
   */
  getPlaylistCount: async (id: string): Promise<number> => {
    const response = await mainApiClient.get<PlaylistCountResponse>(
      MAIN_API_ENDPOINTS.songs.playlistCount(id)
    );
    return response.count;
  },

  /**
   * Delete song
   */
  delete: async (id: string): Promise<void> => {
    return mainApiClient.delete(MAIN_API_ENDPOINTS.songs.delete(id));
  },
};
