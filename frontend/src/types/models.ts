/**
 * Frontend data models
 * Simplified versions of Prisma models for client-side usage
 * 
 * Backend original models location: prisma/schema.prisma
 * These interfaces are frontend-friendly versions with:
 * - Date objects converted to ISO strings
 * - Optional relations for flexible queries
 * - Computed fields like _count for aggregations
 */

/**
 * User model
 * Backend: prisma/schema.prisma -> model User
 */
export interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

/**
 * Library model
 * Backend: prisma/schema.prisma -> model Library
 */
export interface Library {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    songs: number;
  };
}

/**
 * Library with songs relation
 */
export interface LibraryWithSongs extends Library {
  songs: Song[];
}

/**
 * Song model
 * Backend: prisma/schema.prisma -> model Song
 */
export interface Song {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  duration: number | null;
  coverArtUrl: string | null;
  libraryId: string;
  fileId: string;
  createdAt: string;
  updatedAt: string;
  file?: {
    id: string;
    duration: number | null;
  } | null;
  library?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Playlist model
 * Backend: prisma/schema.prisma -> model Playlist
 */
export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    songs: number;
  };
  songs?: PlaylistSong[];
}

/**
 * PlaylistSong relation model
 * Backend: prisma/schema.prisma -> model PlaylistSong
 */
export interface PlaylistSong {
  playlistId: string;
  songId: string;
  position: number;
  addedAt: string;
  song: Song;
}

/**
 * Simplified library data for dropdowns/selections
 */
export interface LibraryOption {
  id: string;
  name: string;
  songCount: number;
  description: string | null;
}

/**
 * Simplified playlist data for dropdowns/selections
 */
export interface PlaylistOption {
  id: string;
  name: string;
}

/**
 * Playlist track response for player
 * Simplified song data optimized for playback
 */
export interface PlaylistTrackResponse {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  coverUrl: string | null;
  duration: number | null;
  mimeType: string | null;
}
