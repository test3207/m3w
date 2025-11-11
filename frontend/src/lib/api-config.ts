/**
 * API Configuration
 * All endpoints are relative paths. Base URL is configured in apiClient.
 */

export const API_ENDPOINTS = {
  // Auth
  auth: {
    github: '/api/auth/github',
    callback: '/api/auth/callback',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
    signout: '/api/auth/signout',
  },
  // Libraries
  libraries: {
    list: '/api/libraries',
    detail: (id: string) => `/api/libraries/${id}`,
    songs: (id: string) => `/api/libraries/${id}/songs`,
    create: '/api/libraries',
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
    stream: (id: string) => `/api/songs/${id}/stream`,
    playlistCount: (id: string) => `/api/songs/${id}/playlist-count`,
    delete: (id: string) => `/api/songs/${id}`,
  },
  // Upload
  upload: {
    song: '/api/upload/song',
  },
  // Player
  player: {
    seed: '/api/player/seed',
    progress: '/api/player/progress',
    preferences: '/api/player/preferences',
  },
} as const;
