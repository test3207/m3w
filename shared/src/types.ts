/**
 * Shared TypeScript types for M3W project
 * Used by backend, frontend, and offline proxy
 */

// User types
export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  createdAt: string; // ISO 8601 string from JSON serialization
  updatedAt: string; // ISO 8601 string from JSON serialization
}

// Library types
export interface Library {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  createdAt: string; // ISO 8601 string from JSON serialization
  updatedAt: string; // ISO 8601 string from JSON serialization
  _count: {
    songs: number;
  };
}

// Deprecated: Use Library directly as backend always includes _count
/** @deprecated Backend always returns _count, use Library instead */
export interface LibraryWithCount extends Library {}

export interface CreateLibraryInput {
  name: string;
  description?: string | null;
}

export interface UpdateLibraryInput {
  name?: string;
  description?: string | null;
}

// Playlist types
export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  createdAt: string; // ISO 8601 string from JSON serialization
  updatedAt: string; // ISO 8601 string from JSON serialization
  _count: {
    songs: number;
  };
}

// Deprecated: Use Playlist directly as backend always includes _count
/** @deprecated Backend always returns _count, use Playlist instead */
export interface PlaylistWithCount extends Playlist {}

export interface CreatePlaylistInput {
  name: string;
  description?: string | null;
}

export interface UpdatePlaylistInput {
  name?: string;
  description?: string | null;
}

// Song types
export interface Song {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  year: number | null;
  genre: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  composer: string | null;
  coverUrl: string | null;
  fileId: string;
  libraryId: string;
  createdAt: string; // ISO 8601 string from JSON serialization
  updatedAt: string; // ISO 8601 string from JSON serialization
  // Optional relations (included when queried with include)
  file?: {
    id: string;
    hash: string;
    path: string;
    size: number;
    mimeType: string;
    duration: number | null;
    bitrate: number | null;
    sampleRate: number | null;
    channels: number | null;
  };
  library?: {
    id: string;
    name: string;
  };
}

export interface CreateSongInput {
  title: string;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  year?: number | null;
  genre?: string | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  composer?: string | null;
  coverUrl?: string | null;
  fileId: string;
  libraryId: string;
}

export interface UpdateSongInput {
  title?: string;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  year?: number | null;
  genre?: string | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  composer?: string | null;
  coverUrl?: string | null;
}

// Playlist-Song association
export interface PlaylistSong {
  id: string;
  playlistId: string;
  songId: string;
  position: number;
  addedAt: Date;
}

export interface AddSongToPlaylistInput {
  songId: string;
  position?: number;
}

// File types
export interface FileRecord {
  id: string;
  hash: string;
  size: number;
  mimeType: string;
  storageKey: string;
  refCount: number;
  createdAt: string; // ISO 8601 string from JSON serialization
  updatedAt: string; // ISO 8601 string from JSON serialization
}

// Upload types
export interface UploadSongInput {
  file: File | Blob;
  libraryId: string;
  title?: string;
  artist?: string;
  album?: string;
}

// Authentication types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
