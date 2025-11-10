/**
 * API Configuration
 * All endpoints use relative paths without /api prefix
 * apiClient will add /api prefix automatically
 * For direct fetch calls, use with /api prefix manually
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
    list: '/libraries',
    detail: (id: string) => `/libraries/${id}`,
    songs: (id: string) => `/libraries/${id}/songs`,
    create: '/libraries',
    delete: (id: string) => `/libraries/${id}`,
  },
  // Playlists
  playlists: {
    list: '/playlists',
    detail: (id: string) => `/playlists/${id}`,
    songs: (id: string) => `/playlists/${id}/songs`,
    create: '/playlists',
    update: (id: string) => `/playlists/${id}`,
    delete: (id: string) => `/playlists/${id}`,
    addSong: (id: string) => `/playlists/${id}/songs`,
    removeSong: (playlistId: string, songId: string) => `/playlists/${playlistId}/songs/${songId}`,
    reorderSongs: (id: string) => `/playlists/${id}/songs/reorder`,
  },
  // Songs
  songs: {
    stream: (id: string) => `/songs/${id}/stream`,
    playlistCount: (id: string) => `/songs/${id}/playlist-count`,
    delete: (id: string) => `/songs/${id}`,
  },
  // Upload
  upload: {
    song: '/upload/song',
  },
  // Player
  player: {
    seed: '/player/seed',
    progress: '/player/progress',
    preferences: '/player/preferences',
  },
} as const;
