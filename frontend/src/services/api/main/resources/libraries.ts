/**
 * Libraries Resource Service
 */

import { mainApiClient } from "../client";
import { MAIN_API_ENDPOINTS } from "../endpoints";
import type { Library, Song, CreateLibraryInput, UpdateLibraryInput, SongSortOption } from "@m3w/shared";

// Re-export shared types for convenience
export type { CreateLibraryInput, UpdateLibraryInput };

export const libraries = {
  /**
   * List all libraries
   * Returns libraries with new fields: coverUrl, isDefault, canDelete
   */
  list: async (): Promise<Library[]> => {
    return mainApiClient.get<Library[]>(MAIN_API_ENDPOINTS.libraries.list);
  },

  /**
   * Get library by ID
   */
  getById: async (id: string): Promise<Library> => {
    return mainApiClient.get<Library>(MAIN_API_ENDPOINTS.libraries.detail(id));
  },

  /**
   * Get songs in library with optional sorting
   * @param id - Library ID
   * @param sort - Sort option (date-desc, date-asc, title-asc, title-desc, artist-asc, album-asc)
   */
  getSongs: async (id: string, sort?: SongSortOption): Promise<Song[]> => {
    const url = sort
      ? `${MAIN_API_ENDPOINTS.libraries.songs(id)}?sort=${sort}`
      : MAIN_API_ENDPOINTS.libraries.songs(id);
    return mainApiClient.get<Song[]>(url);
  },

  /**
   * Create new library
   */
  create: async (data: CreateLibraryInput): Promise<Library> => {
    return mainApiClient.post<Library>(MAIN_API_ENDPOINTS.libraries.create, data);
  },

  /**
   * Update library
   */
  update: async (id: string, data: UpdateLibraryInput): Promise<Library> => {
    return mainApiClient.patch<Library>(MAIN_API_ENDPOINTS.libraries.update(id), data);
  },

  /**
   * Delete library
   * Note: Cannot delete default library (canDelete === false)
   */
  delete: async (id: string): Promise<void> => {
    return mainApiClient.delete(MAIN_API_ENDPOINTS.libraries.delete(id));
  },
};
