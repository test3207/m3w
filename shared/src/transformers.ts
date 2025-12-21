/**
 * API Response Transformers
 * 
 * These functions transform database models (Prisma or IndexedDB) into
 * consistent API response types. Both backend and offline-proxy should
 * use these transformers to ensure response shape consistency.
 * 
 * Usage:
 * - Backend: Transform Prisma query results before returning to client
 * - Offline-Proxy: Transform IndexedDB records to match API response shape
 */

import type { Library, Playlist, Song, CacheOverride } from './types';

// ============================================================
// Input Types (Database Models)
// These represent what comes from Prisma or IndexedDB
// ============================================================

/**
 * Library from database with optional relations
 */
export interface LibraryInput {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  songCount: number;  // Cached count stored in database
  isDefault: boolean;
  canDelete: boolean;
  cacheOverride?: string;  // Optional for backward compatibility
  createdAt: Date | string;
  updatedAt: Date | string;
  // Optional: song ID for cover (last added song)
  coverSongId?: string | null;
}

/**
 * Playlist from database with optional relations
 */
export interface PlaylistInput {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  songCount: number;  // Cached count stored in database
  linkedLibraryId: string | null;
  isDefault: boolean;
  canDelete: boolean;
  coverSongId?: string | null;  // Song ID for cover (first song)
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Song from database with file relation
 */
export interface SongInput {
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
  fileId: string;
  libraryId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Optional: from file relation
  file?: {
    duration?: number | null;
    mimeType?: string | null;
  } | null;
  // Optional: from library relation
  library?: {
    name: string;
  } | null;
  // Alternative: direct fields (for pre-flattened data)
  duration?: number | null;
  mimeType?: string | null;
  libraryName?: string | null;
}

// ============================================================
// Transformer Functions
// ============================================================

/**
 * Convert Date to ISO 8601 string
 */
function toISOString(date: Date | string): string {
  if (typeof date === 'string') {
    return date;
  }
  return date.toISOString();
}

/**
 * Transform database Library to API response Library
 */
export function toLibraryResponse(input: LibraryInput): Library {
  // Default to 'inherit' if not set (backward compatibility)
  const cacheOverride = (input.cacheOverride ?? 'inherit') as CacheOverride;
  
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    userId: input.userId,
    songCount: input.songCount,
    isDefault: input.isDefault,
    canDelete: input.canDelete,
    cacheOverride,
    coverSongId: input.coverSongId ?? null,
    createdAt: toISOString(input.createdAt),
    updatedAt: toISOString(input.updatedAt),
  };
}

/**
 * Transform database Playlist to API response Playlist
 */
export function toPlaylistResponse(input: PlaylistInput): Playlist {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    userId: input.userId,
    songCount: input.songCount,
    linkedLibraryId: input.linkedLibraryId ?? null,
    isDefault: input.isDefault,
    canDelete: input.canDelete,
    coverSongId: input.coverSongId ?? null,
    createdAt: toISOString(input.createdAt),
    updatedAt: toISOString(input.updatedAt),
  };
}

/**
 * Transform database Song to API response Song
 * Flattens file and library relations into the response
 */
export function toSongResponse(input: SongInput): Song {
  return {
    id: input.id,
    title: input.title,
    artist: input.artist,
    album: input.album,
    albumArtist: input.albumArtist,
    year: input.year,
    genre: input.genre,
    trackNumber: input.trackNumber,
    discNumber: input.discNumber,
    composer: input.composer,
    fileId: input.fileId,
    libraryId: input.libraryId,
    // Computed fields: prioritize direct fields, then relations
    libraryName: input.libraryName ?? input.library?.name ?? null,
    duration: input.duration ?? input.file?.duration ?? null,
    mimeType: input.mimeType ?? input.file?.mimeType ?? null,
    createdAt: toISOString(input.createdAt),
    updatedAt: toISOString(input.updatedAt),
  };
}

/**
 * Transform array of database Libraries to API response
 */
export function toLibraryListResponse(inputs: LibraryInput[]): Library[] {
  return inputs.map(toLibraryResponse);
}

/**
 * Transform array of database Playlists to API response
 */
export function toPlaylistListResponse(inputs: PlaylistInput[]): Playlist[] {
  return inputs.map(toPlaylistResponse);
}

/**
 * Transform array of database Songs to API response
 */
export function toSongListResponse(inputs: SongInput[]): Song[] {
  return inputs.map(toSongResponse);
}
