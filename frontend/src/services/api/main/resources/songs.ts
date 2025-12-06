/**
 * Songs Resource Service
 */

import { mainApiClient } from "../client";
import { MAIN_API_ENDPOINTS } from "../endpoints";
import type { Song, SongSearchParams, UpdateSongInput, SongPlaylistCount } from "@m3w/shared";

// Re-export shared types
export type { UpdateSongInput, SongSearchParams };

export const songs = {
  /**
   * Search songs across all or specific library
   * @param params - { q: string, libraryId?: string, sort?: SongSortOption }
   */
  search: async (params: SongSearchParams): Promise<Song[]> => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set("q", params.q);
    if (params.libraryId) searchParams.set("libraryId", params.libraryId);
    if (params.sort) searchParams.set("sort", params.sort);

    const url = `${MAIN_API_ENDPOINTS.songs.search}?${searchParams.toString()}`;
    return mainApiClient.get<Song[]>(url);
  },

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
    const response = await mainApiClient.get<SongPlaylistCount>(
      MAIN_API_ENDPOINTS.songs.playlistCount(id)
    );
    return response.count;
  },

  /**
   * Delete song from library
   * @param id - Song ID
   * @param libraryId - Library ID (required to prevent cross-library deletion)
   */
  delete: async (id: string, libraryId: string): Promise<void> => {
    return mainApiClient.delete(MAIN_API_ENDPOINTS.songs.delete(id, libraryId));
  },
};
