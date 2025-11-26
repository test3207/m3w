/**
 * Main API Endpoints
 * All endpoints are relative paths. Base URL is configured in apiClient.
 */

/**
 * Get stream URL based on current auth context
 * Guest mode: /guest/songs/:id/stream (served by Service Worker from Cache Storage)
 * Auth mode: /api/songs/:id/stream (fetched from backend with token)
 */
export function getStreamUrl(songId: string, isGuest: boolean): string {
  return isGuest ? `/guest/songs/${songId}/stream` : `/api/songs/${songId}/stream`;
}

export const MAIN_API_ENDPOINTS = {
  // Auth
  auth: {
    github: '/api/auth/github',
    callback: '/api/auth/callback',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
    logout: '/api/auth/logout',
  },
  // Libraries
  libraries: {
    list: '/api/libraries',
    detail: (id: string) => `/api/libraries/${id}`,
    songs: (id: string) => `/api/libraries/${id}/songs`,
    create: '/api/libraries',
    update: (id: string) => `/api/libraries/${id}`,
    delete: (id: string) => `/api/libraries/${id}`,
  },
  // Playlists
  playlists: {
    list: '/api/playlists',
    detail: (id: string) => `/api/playlists/${id}`,
    songs: (id: string) => `/api/playlists/${id}/songs`,
    create: '/api/playlists',
    update: (id: string) => `/api/playlists/${id}`,
    delete: (id: string) => `/api/playlists/${id}`,
    addSong: (id: string) => `/api/playlists/${id}/songs`,
    removeSong: (playlistId: string, songId: string) => `/api/playlists/${playlistId}/songs/${songId}`,
    reorderSongs: (id: string) => `/api/playlists/${id}/songs/reorder`,
  },
  // Songs
  songs: {
    search: '/api/songs/search',
    detail: (id: string) => `/api/songs/${id}`,
    update: (id: string) => `/api/songs/${id}`,
    stream: (id: string) => `/api/songs/${id}/stream`,
    playlistCount: (id: string) => `/api/songs/${id}/playlist-count`,
    delete: (id: string, libraryId: string) => `/api/songs/${id}?libraryId=${libraryId}`,
  },
  // Upload
  upload: {
    file: '/api/upload',
  },
  // Player
  player: {
    seed: '/api/player/seed',
    progress: '/api/player/progress',
    preferences: '/api/player/preferences',
  },
  // Demo
  demo: {
    storage: '/api/demo/storage',
  },
} as const;
