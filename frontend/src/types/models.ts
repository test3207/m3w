/**
 * Frontend-specific data models
 * 
 * Core types (Library, Playlist, Song, User) are imported from @m3w/shared.
 * This file contains frontend-only extensions and utility types.
 * 
 * Backend original models location: prisma/schema.prisma
 */

import type { Library, Playlist, Song } from "@m3w/shared";

// Re-export shared types for convenience
export type { Library, Playlist, Song } from "@m3w/shared";
export type { User } from "@m3w/shared";

/**
 * Library with songs relation (frontend-only extension)
 */
export interface LibraryWithSongs extends Library {
  songs: Song[];
}

/**
 * Playlist with songs relation (frontend-only extension)
 */
export interface PlaylistWithSongs extends Playlist {
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
