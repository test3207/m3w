/**
 * Libraries Resource Service
 */

import { mainApiClient } from '../client';
import { MAIN_API_ENDPOINTS } from '../endpoints';
import type { Library, Song, CreateLibraryInput, UpdateLibraryInput } from '@m3w/shared';

// Re-export shared types for convenience
export type { CreateLibraryInput, UpdateLibraryInput };

export const libraries = {
  /**
   * List all libraries
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
   * Get songs in library
   */
  getSongs: async (id: string): Promise<Song[]> => {
    return mainApiClient.get<Song[]>(MAIN_API_ENDPOINTS.libraries.songs(id));
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
   */
  delete: async (id: string): Promise<void> => {
    return mainApiClient.delete(MAIN_API_ENDPOINTS.libraries.delete(id));
  },
};
