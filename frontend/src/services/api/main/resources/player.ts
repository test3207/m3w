/**
 * Player Resource Service
 */

import { mainApiClient } from '../client';
import { MAIN_API_ENDPOINTS } from '../endpoints';

export interface Track {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  duration?: number;
  audioUrl: string;
  mimeType?: string;
}

export interface PlayContext {
  type: 'library' | 'playlist';
  id: string;
  name?: string;
}

export interface PlaybackProgress {
  track: Track;
  position: number;
  context?: PlayContext | null;
  updatedAt: string;
}

export interface PlaybackPreferences {
  shuffleEnabled: boolean;
  repeatMode: 'off' | 'all' | 'one';
}

export interface PlaybackSeed {
  track: Track;
  context: PlayContext;
}

export interface UpdateProgressInput {
  songId: string;
  position: number;
  contextType?: 'library' | 'playlist';
  contextId?: string;
  contextName?: string;
}

export interface UpdatePreferencesInput {
  shuffleEnabled?: boolean;
  repeatMode?: 'off' | 'all' | 'one';
}

export const player = {
  /**
   * Get default playback seed (first song recommendation)
   */
  getSeed: async (): Promise<PlaybackSeed | null> => {
    return mainApiClient.get<PlaybackSeed | null>(MAIN_API_ENDPOINTS.player.seed);
  },

  /**
   * Get last playback progress
   */
  getProgress: async (): Promise<PlaybackProgress | null> => {
    return mainApiClient.get<PlaybackProgress | null>(MAIN_API_ENDPOINTS.player.progress);
  },

  /**
   * Update playback progress
   */
  updateProgress: async (data: UpdateProgressInput): Promise<void> => {
    return mainApiClient.put(MAIN_API_ENDPOINTS.player.progress, data);
  },

  /**
   * Get playback preferences
   */
  getPreferences: async (): Promise<PlaybackPreferences | null> => {
    return mainApiClient.get<PlaybackPreferences | null>(MAIN_API_ENDPOINTS.player.preferences);
  },

  /**
   * Update playback preferences
   */
  updatePreferences: async (data: UpdatePreferencesInput): Promise<void> => {
    return mainApiClient.put(MAIN_API_ENDPOINTS.player.preferences, data);
  },
};
