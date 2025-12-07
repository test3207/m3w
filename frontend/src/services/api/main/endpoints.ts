/**
 * Main API Endpoints
 * All endpoints are relative paths. Base URL is configured in apiClient.
 * 
 * @related When modifying endpoints, sync these files:
 * - shared/src/api-contracts.ts - Route definitions and offline capability
 * - backend/src/routes/*.ts - Backend route handlers
 * - frontend/src/lib/offline-proxy/routes/*.ts - Offline proxy handlers
 * - frontend/src/services/api/main/resources/*.ts - Frontend API methods
 */

/**
 * Get stream URL for audio files
 * Always returns /api/songs/:id/stream regardless of auth mode.
 * Service Worker handles caching for both Guest and Auth scenarios.
 */
export function getStreamUrl(songId: string): string {
  return `/api/songs/${songId}/stream`;
}

/**
 * Get cover URL for album art
 * Same unified strategy as getStreamUrl
 */
export function getCoverUrl(songId: string): string {
  return `/api/songs/${songId}/cover`;
}

export const MAIN_API_ENDPOINTS = {
  // Auth
  auth: {
    github: "/api/auth/github",
    callback: "/api/auth/callback",
    refresh: "/api/auth/refresh",
    me: "/api/auth/me",
    logout: "/api/auth/logout",
  },
  // User
  user: {
    preferences: "/api/user/preferences",
  },
  // Libraries
  libraries: {
    list: "/api/libraries",
    detail: (id: string) => `/api/libraries/${id}`,
    songs: (id: string) => `/api/libraries/${id}/songs`,
    create: "/api/libraries",
    update: (id: string) => `/api/libraries/${id}`,
    delete: (id: string) => `/api/libraries/${id}`,
    uploadSong: (id: string) => `/api/libraries/${id}/songs`,
  },
  // Playlists
  playlists: {
    list: "/api/playlists",
    detail: (id: string) => `/api/playlists/${id}`,
    songs: (id: string) => `/api/playlists/${id}/songs`,
    create: "/api/playlists",
    update: (id: string) => `/api/playlists/${id}`,
    delete: (id: string) => `/api/playlists/${id}`,
    addSong: (id: string) => `/api/playlists/${id}/songs`,
    removeSong: (playlistId: string, songId: string) => `/api/playlists/${playlistId}/songs/${songId}`,
    reorderSongs: (id: string) => `/api/playlists/${id}/songs/reorder`,
  },
  // Songs
  songs: {
    search: "/api/songs/search",
    detail: (id: string) => `/api/songs/${id}`,
    update: (id: string) => `/api/songs/${id}`,
    stream: (id: string) => `/api/songs/${id}/stream`,
    playlistCount: (id: string) => `/api/songs/${id}/playlist-count`,
    delete: (id: string, libraryId: string) => `/api/songs/${id}?libraryId=${libraryId}`,
  },
  // Player
  player: {
    seed: "/api/player/seed",
    progress: "/api/player/progress",
    preferences: "/api/player/preferences",
  },
  // Demo
  demo: {
    storage: "/api/demo/storage",
  },
} as const;
