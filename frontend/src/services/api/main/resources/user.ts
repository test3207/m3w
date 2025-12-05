/**
 * User Resource Service
 */

import { mainApiClient } from '../client';
import { MAIN_API_ENDPOINTS } from '../endpoints';
import type { UserPreferences } from '@m3w/shared';

// Re-export shared types for convenience
export type { UserPreferences };

export const user = {
  /**
   * Get user preferences
   */
  getPreferences: async (): Promise<UserPreferences> => {
    return mainApiClient.get<UserPreferences>(MAIN_API_ENDPOINTS.user.preferences);
  },

  /**
   * Update user preferences
   */
  updatePreferences: async (data: Partial<UserPreferences>): Promise<UserPreferences> => {
    return mainApiClient.put<UserPreferences>(MAIN_API_ENDPOINTS.user.preferences, data);
  },
};
