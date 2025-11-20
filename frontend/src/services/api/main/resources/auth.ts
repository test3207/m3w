/**
 * Auth Resource Service
 */

import { mainApiClient } from '../client';
import { MAIN_API_ENDPOINTS } from '../endpoints';
import type { AuthTokens } from '@m3w/shared';

// Re-export shared types for convenience
export type { AuthTokens };

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  githubId?: string; // Optional: only present for GitHub-authenticated users
  createdAt: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export const auth = {
  /**
   * Get GitHub OAuth URL
   */
  getGithubAuthUrl: (): string => {
    return MAIN_API_ENDPOINTS.auth.github;
  },

  /**
   * Get current user
   */
  getMe: async (): Promise<User> => {
    return mainApiClient.get<User>(MAIN_API_ENDPOINTS.auth.me);
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    return mainApiClient.post<RefreshTokenResponse>(MAIN_API_ENDPOINTS.auth.refresh, { refreshToken });
  },

  /**
   * Sign out
   */
  signout: async (): Promise<void> => {
    return mainApiClient.post(MAIN_API_ENDPOINTS.auth.signout);
  },
};
