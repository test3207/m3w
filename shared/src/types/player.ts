/**
 * Player entity types
 * Handles playback preferences, progress, and state
 */

// ============================================================
// Enums and Constants
// ============================================================

export type RepeatMode = 'off' | 'all' | 'one';
export type PlaybackContextType = 'library' | 'playlist' | 'album' | 'search' | 'queue';

// ============================================================
// Player State Types
// ============================================================

/**
 * Playback preferences
 * Used by GET/PUT /api/player/preferences
 */
export interface PlaybackPreferences {
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
}

/**
 * Playback context (library/playlist/album being played)
 */
export interface PlaybackContext {
  type: PlaybackContextType;
  id: string;
  name: string | null;
}

/**
 * Track info for player
 */
export interface PlayerTrack {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  coverUrl: string | null;
  duration?: number;
  audioUrl?: string;
  mimeType?: string;
}

// ============================================================
// Player API Response Types
// ============================================================

/**
 * Playback seed (initial track to play)
 * Used by GET /api/player/seed
 */
export interface PlaybackSeed {
  track: PlayerTrack;
  context: PlaybackContext;
}

/**
 * Playback progress
 * Used by GET /api/player/progress
 */
export interface PlaybackProgress {
  track: PlayerTrack;
  position: number;
  context: PlaybackContext | null;
  updatedAt: string; // ISO 8601 string
}

// ============================================================
// Player Operation Results
// ============================================================

/**
 * Progress sync confirmation
 * Used by PUT /api/player/progress
 */
export interface ProgressSyncResult {
  synced: boolean;
}

/**
 * Preferences update confirmation
 * Used by PUT /api/player/preferences (offline)
 */
export interface PreferencesUpdateResult {
  updated: boolean;
}
