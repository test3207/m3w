/**
 * API Contracts for M3W project
 * 
 * Defines route definitions with offline capability flags to ensure:
 * 1. Backend and offline-proxy implement the same API surface
 * 2. Router knows which routes can fallback to IndexedDB when offline
 * 3. Clear documentation of which operations work without network
 * 
 * @related When modifying routes, sync these files:
 * - backend/src/routes/*.ts - Backend route handlers
 * - backend/src/index.ts - Backend route registration
 * - frontend/src/lib/offline-proxy/routes/*.ts - Offline proxy handlers
 * - frontend/src/lib/offline-proxy/index.ts - Offline proxy registration
 * - frontend/src/services/api/main/endpoints.ts - Frontend endpoint definitions
 * - frontend/src/services/api/main/resources/*.ts - Frontend API service methods
 * 
 * Contract enforcement:
 * - Route paths and methods must match between backend and offline-proxy
 * - Zod schemas in shared/src/schemas.ts ensure request/response consistency
 * - TypeScript types in shared/src/types.ts enforce data structure compatibility
 */

/**
 * Cache configuration for GET routes
 * Determines how router caches responses to IndexedDB for offline access
 * Uses discriminated union to ensure keyParam is required for 'replace-by-key' strategy
 */
/**
 * Target IndexedDB tables for caching
 * Note: 'playlistSongs' join table is updated internally by cacheSongsForPlaylist(),
 * not directly via CacheConfig. It's managed through updateJoinTable flag.
 */
export type CacheTable = 'libraries' | 'playlists' | 'songs';

export type CacheConfig = 
  | {
      /** Target IndexedDB table */
      table: CacheTable;
      /** Cache strategy: full replacement of table data */
      strategy: 'replace-all';
    }
  | {
      /** Target IndexedDB table */
      table: CacheTable;
      /** Cache strategy: insert or update single record */
      strategy: 'upsert';
    }
  | {
      /** Target IndexedDB table */
      table: CacheTable;
      /** Cache strategy: replace all records matching a key */
      strategy: 'replace-by-key';
      /** The parameter name to use as key (e.g., 'id' for libraryId) - required for this strategy */
      keyParam: string;
      /** For playlist songs: also update playlistSongs join table */
      updateJoinTable?: boolean;
    };

export interface RouteDefinition {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  offlineCapable: boolean;
  description: string;
  /** Cache configuration for GET routes (router auto-caches responses) */
  cacheConfig?: CacheConfig;
}

/**
 * User Data Routes - Offline capable
 * These routes work both online (real backend) and offline (IndexedDB proxy)
 */
export const userDataRoutes: RouteDefinition[] = [
  // Libraries
  {
    path: '/api/libraries',
    method: 'GET',
    offlineCapable: true,
    description: 'List all libraries for current user',
    cacheConfig: { table: 'libraries', strategy: 'replace-all' },
  },
  {
    path: '/api/libraries/:id',
    method: 'GET',
    offlineCapable: true,
    description: 'Get library by ID',
    cacheConfig: { table: 'libraries', strategy: 'upsert' },
  },
  {
    path: '/api/libraries',
    method: 'POST',
    offlineCapable: true,
    description: 'Create new library (queued when offline)',
  },
  {
    path: '/api/libraries/:id',
    method: 'PATCH',
    offlineCapable: true,
    description: 'Update library (queued when offline)',
  },
  {
    path: '/api/libraries/:id',
    method: 'DELETE',
    offlineCapable: true,
    description: 'Delete library (queued when offline)',
  },
  {
    path: '/api/libraries/:id/songs',
    method: 'GET',
    offlineCapable: true,
    description: 'List songs in library',
    cacheConfig: { table: 'songs', strategy: 'replace-by-key', keyParam: 'id' },
  },
  {
    path: '/api/libraries/:id/songs',
    method: 'POST',
    offlineCapable: true,
    description: 'Upload audio file to library (local storage when offline)',
  },

  // Playlists
  {
    path: '/api/playlists',
    method: 'GET',
    offlineCapable: true,
    description: 'List all playlists for current user',
    cacheConfig: { table: 'playlists', strategy: 'replace-all' },
  },
  {
    path: '/api/playlists/:id',
    method: 'GET',
    offlineCapable: true,
    description: 'Get playlist by ID',
    cacheConfig: { table: 'playlists', strategy: 'upsert' },
  },
  {
    path: '/api/playlists',
    method: 'POST',
    offlineCapable: true,
    description: 'Create new playlist (queued when offline)',
  },
  {
    path: '/api/playlists/:id',
    method: 'PATCH',
    offlineCapable: true,
    description: 'Update playlist (queued when offline)',
  },
  {
    path: '/api/playlists/:id',
    method: 'DELETE',
    offlineCapable: true,
    description: 'Delete playlist (queued when offline)',
  },
  {
    path: '/api/playlists/:id/songs',
    method: 'GET',
    offlineCapable: true,
    description: 'List songs in playlist',
    cacheConfig: { table: 'songs', strategy: 'replace-by-key', keyParam: 'id', updateJoinTable: true },
  },
  {
    path: '/api/playlists/:id/songs',
    method: 'POST',
    offlineCapable: true,
    description: 'Add song to playlist (queued when offline)',
  },
  {
    path: '/api/playlists/:id/songs/:songId',
    method: 'DELETE',
    offlineCapable: true,
    description: 'Remove song from playlist (queued when offline)',
  },
  {
    path: '/api/playlists/:id/songs/reorder',
    method: 'PUT',
    offlineCapable: true,
    description: 'Reorder songs in playlist (queued when offline)',
  },
  {
    path: '/api/playlists/by-library/:libraryId',
    method: 'GET',
    offlineCapable: true,
    description: 'Get playlist linked to library',
  },
  {
    path: '/api/playlists/for-library',
    method: 'POST',
    offlineCapable: true,
    description: 'Create playlist linked to library (queued when offline)',
  },
  {
    path: '/api/playlists/:id/songs',
    method: 'PUT',
    offlineCapable: true,
    description: 'Update playlist songs (batch update)',
  },

  // Songs
  {
    path: '/api/songs/:id',
    method: 'GET',
    offlineCapable: true,
    description: 'Get song by ID',
    cacheConfig: { table: 'songs', strategy: 'upsert' },
  },
  {
    path: '/api/songs/:id',
    method: 'PATCH',
    offlineCapable: true,
    description: 'Update song metadata (queued when offline)',
  },
  {
    path: '/api/songs/:id',
    method: 'DELETE',
    offlineCapable: true,
    description: 'Delete song (queued when offline)',
  },
  {
    path: '/api/songs/:id/stream',
    method: 'GET',
    offlineCapable: true,
    description: 'Stream audio file (local blob when offline)',
  },
];

/**
 * Admin Routes - Online only
 * These routes require network connection and never work offline
 */
export const adminRoutes: RouteDefinition[] = [
  // Health check
  {
    path: '/api/health',
    method: 'GET',
    offlineCapable: false,
    description: 'Backend health check endpoint',
  },

  // Authentication
  {
    path: '/api/auth/login',
    method: 'POST',
    offlineCapable: false,
    description: 'GitHub OAuth login callback',
  },
  {
    path: '/api/auth/refresh',
    method: 'POST',
    offlineCapable: false,
    description: 'Refresh access token',
  },
  {
    path: '/api/auth/me',
    method: 'GET',
    offlineCapable: false,
    description: 'Get current user info',
  },
  {
    path: '/api/auth/logout',
    method: 'POST',
    offlineCapable: false,
    description: 'Logout and invalidate tokens',
  },

  // User Management
  {
    path: '/api/users/:id',
    method: 'GET',
    offlineCapable: false,
    description: 'Get user by ID (admin only)',
  },
  {
    path: '/api/users/:id',
    method: 'PATCH',
    offlineCapable: false,
    description: 'Update user (admin only)',
  },

  // Player state (optional backend sync)
  {
    path: '/api/player/progress',
    method: 'GET',
    offlineCapable: true,
    description: 'Get last playback progress',
  },
  {
    path: '/api/player/progress',
    method: 'PUT',
    offlineCapable: true,
    description: 'Sync playback progress to server',
  },
  {
    path: '/api/player/seed',
    method: 'GET',
    offlineCapable: true,
    description: 'Get default playback seed',
  },
  {
    path: '/api/player/preferences',
    method: 'GET',
    offlineCapable: true,
    description: 'Get user playback preferences',
  },
  {
    path: '/api/player/preferences',
    method: 'PATCH',
    offlineCapable: true,
    description: 'Update user playback preferences',
  },
  {
    path: '/api/player/preferences',
    method: 'PUT',
    offlineCapable: true,
    description: 'Update user playback preferences (alias for PATCH)',
  },
];

/**
 * All routes combined
 */
export const allRoutes = [...userDataRoutes, ...adminRoutes];

/**
 * Helper function to check if a route is offline capable
 */
export function isOfflineCapable(path: string, method: string): boolean {
  const route = allRoutes.find(
    (r) => matchPath(r.path, path) && r.method === method
  );
  return route?.offlineCapable ?? false;
}

/**
 * Get cache configuration for a route
 * Returns the cacheConfig if the route should be cached, undefined otherwise
 */
export function getCacheConfig(path: string, method: string): { config: CacheConfig; params: Record<string, string> } | undefined {
  if (method !== 'GET') return undefined;
  
  const route = allRoutes.find(
    (r) => matchPath(r.path, path) && r.method === method
  );
  
  if (!route?.cacheConfig) return undefined;
  
  const params = extractParams(route.path, path);
  return { config: route.cacheConfig, params };
}

/**
 * Simple path matching (supports :param syntax)
 */
function matchPath(pattern: string, path: string): boolean {
  // Remove query string from path before matching
  const cleanPath = path.split('?')[0];
  
  const patternParts = pattern.split('/');
  const pathParts = cleanPath.split('/');

  if (patternParts.length !== pathParts.length) {
    return false;
  }

  return patternParts.every((part, i) => {
    if (part.startsWith(':')) {
      return true; // Parameter segment matches anything
    }
    return part === pathParts[i];
  });
}

/**
 * Extract route parameters
 */
export function extractParams(
  pattern: string,
  path: string
): Record<string, string> {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  const params: Record<string, string> = {};

  patternParts.forEach((part, i) => {
    if (part.startsWith(':')) {
      const paramName = part.slice(1);
      params[paramName] = pathParts[i];
    }
  });

  return params;
}
