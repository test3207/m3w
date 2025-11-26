/**
 * Unified Service Facade
 * Central export point for all API services
 */

import { libraries } from './api/main/resources/libraries';
import { playlists } from './api/main/resources/playlists';
import { songs } from './api/main/resources/songs';
import { upload } from './api/main/resources/upload';
import { player } from './api/main/resources/player';
import { auth } from './api/main/resources/auth';

/**
 * Main API services grouped by backend
 */
const main = {
  libraries,
  playlists,
  songs,
  upload,
  player,
  auth,
};

/**
 * API services organized by backend
 * Use this when you need to explicitly specify the backend source
 * 
 * @example
 * ```ts
 * import { api } from '@/services';
 * 
 * const libs = await api.main.libraries.list();
 * // Future: const spotifyTracks = await api.spotify.tracks.search('jazz');
 * ```
 */
export const api = {
  main,
  // Future external services will be added here:
  // spotify,
  // lastfm,
};

/**
 * Default exports for convenient access to main API services
 * These are aliases to api.main.* for cleaner imports
 * 
 * @example
 * ```ts
 * import { libraries, playlists } from '@/services';
 * 
 * const libs = await libraries.list();
 * const playlist = await playlists.getById(id);
 * ```
 */
export { libraries, playlists, songs, upload, player, auth };

/**
 * Re-export types for convenience
 */
export type * from './api/main/resources/libraries';
export type * from './api/main/resources/playlists';
export type * from './api/main/resources/songs';
export type * from './api/main/resources/upload';
export type * from './api/main/resources/player';
export type * from './api/main/resources/auth';
