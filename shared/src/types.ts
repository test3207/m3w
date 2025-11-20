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
  isDefault: boolean;  // Mark default library (auto-created)
  canDelete: boolean;  // Prevent deletion of default library
  coverUrl?: string | null;  // Last added song's cover (computed)
  createdAt: string; // ISO 8601 string from JSON serialization
  updatedAt: string; // ISO 8601 string from JSON serialization
  _count: {
    songs: number;
  };
}

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
  songIds: string[];  // Maintain song order (frontend manages)
  linkedLibraryId?: string | null; // Link to library for "Play All" playlists
  isDefault: boolean; // Mark favorites playlist (auto-created)
  canDelete: boolean; // Prevent deletion of default playlist
  coverUrl?: string | null;  // Cover from first 4 songs (computed)
  createdAt: string; // ISO 8601 string from JSON serialization
  updatedAt: string; // ISO 8601 string from JSON serialization
  _count: {
    songs: number;
  };
}

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
  libraryName?: string;  // For Playlist song list display
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

// Playlist-Song operations
export interface AddSongToPlaylistInput {
  songId: string;
  position?: number;
}

export interface ReorderPlaylistSongsInput {
  songIds: string[];  // New order of song IDs
}

// Sorting and filtering
export type SongSortOption = 
  | 'date-desc'      // Date added (newest first) - DEFAULT
  | 'date-asc'       // Date added (oldest first)
  | 'title-asc'      // Title A-Z (Pinyin for Chinese)
  | 'title-desc'     // Title Z-A
  | 'artist-asc'     // Artist A-Z
  | 'album-asc';     // Album A-Z

export interface SongSearchParams {
  q?: string;          // Search query
  libraryId?: string;  // Filter by Library
  sort?: SongSortOption;
}

// File types (Prisma model used in backend)
// Keeping minimal interface for reference, backend uses Prisma model directly

// Upload types (to be implemented)
// export interface UploadSongInput { ... }

// Authentication types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
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

// Demo Mode types
export interface StorageUsageInfo {
  used: number;
  limit: number;
  usedFormatted: string;
  limitFormatted: string;
  percentage: string;
}
