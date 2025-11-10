/**
 * API Configuration
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const API_ENDPOINTS = {
  // Auth
  auth: {
    github: `${API_BASE_URL}/api/auth/github`,
    callback: `${API_BASE_URL}/api/auth/callback`,
    refresh: `${API_BASE_URL}/api/auth/refresh`,
    me: `${API_BASE_URL}/api/auth/me`,
  },
  // Libraries
  libraries: {
    list: `${API_BASE_URL}/api/libraries`,
    detail: (id: string) => `${API_BASE_URL}/api/libraries/${id}`,
    songs: (id: string) => `${API_BASE_URL}/api/libraries/${id}/songs`,
    create: `${API_BASE_URL}/api/libraries`,
    delete: (id: string) => `${API_BASE_URL}/api/libraries/${id}`,
  },
  // Playlists
  playlists: {
    list: `${API_BASE_URL}/api/playlists`,
    detail: (id: string) => `${API_BASE_URL}/api/playlists/${id}`,
    songs: (id: string) => `${API_BASE_URL}/api/playlists/${id}/songs`,
    create: `${API_BASE_URL}/api/playlists`,
    update: (id: string) => `${API_BASE_URL}/api/playlists/${id}`,
    delete: (id: string) => `${API_BASE_URL}/api/playlists/${id}`,
    addSong: (id: string) => `${API_BASE_URL}/api/playlists/${id}/songs`,
    removeSong: (playlistId: string, songId: string) => `${API_BASE_URL}/api/playlists/${playlistId}/songs/${songId}`,
    reorderSongs: (id: string) => `${API_BASE_URL}/api/playlists/${id}/songs/reorder`,
  },
  // Songs
  songs: {
    stream: (id: string) => `${API_BASE_URL}/api/songs/${id}/stream`,
  },
  // Upload
  upload: {
    song: `${API_BASE_URL}/api/upload/song`,
  },
  // Player
  player: {
    seed: `${API_BASE_URL}/api/player/seed`,
    progress: `${API_BASE_URL}/api/player/progress`,
    preferences: `${API_BASE_URL}/api/player/preferences`,
  },
} as const;
