/**
 * Shared Zod validation schemas for M3W project
 * Used for runtime validation in backend and frontend
 */

import { z } from 'zod';

// Library schemas
export const createLibrarySchema = z.object({
  name: z.string().min(1, 'Library name is required').max(255),
  description: z.string().max(1000).optional().nullable(),
});

export const updateLibrarySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
});

export const libraryIdSchema = z.object({
  id: z.string().min(1, 'Invalid library ID'),
});

// Playlist schemas
export const createPlaylistSchema = z.object({
  name: z.string().min(1, 'Playlist name is required').max(255),
  description: z.string().max(1000).optional().nullable(),
});

export const updatePlaylistSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
});

export const playlistIdSchema = z.object({
  id: z.string().min(1, 'Invalid playlist ID'),
});

// Song schemas
export const createSongSchema = z.object({
  title: z.string().min(1, 'Song title is required').max(255),
  artist: z.string().max(255).optional().nullable(),
  album: z.string().max(255).optional().nullable(),
  albumArtist: z.string().max(255).optional().nullable(),
  year: z.number().int().min(1000).max(9999).optional().nullable(),
  genre: z.string().max(100).optional().nullable(),
  trackNumber: z.number().int().positive().optional().nullable(),
  discNumber: z.number().int().positive().optional().nullable(),
  composer: z.string().max(255).optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  fileId: z.string().min(1, 'File ID is required'),
  libraryId: z.string().min(1, 'Invalid library ID'),
});

export const updateSongSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  artist: z.string().max(255).optional().nullable(),
  album: z.string().max(255).optional().nullable(),
  albumArtist: z.string().max(255).optional().nullable(),
  year: z.number().int().min(1000).max(9999).optional().nullable(),
  genre: z.string().max(100).optional().nullable(),
  trackNumber: z.number().int().positive().optional().nullable(),
  discNumber: z.number().int().positive().optional().nullable(),
  composer: z.string().max(255).optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
});

export const songIdSchema = z.object({
  id: z.string().min(1, 'Invalid song ID'),
});

// Playlist-Song association schemas
export const addSongToPlaylistSchema = z.object({
  songId: z.string().min(1, 'Invalid song ID'),
  position: z.number().int().nonnegative().optional(),
});

export const removeSongFromPlaylistSchema = z.object({
  songId: z.string().min(1, 'Invalid song ID'),
});

export const reorderPlaylistSongSchema = z.object({
  songId: z.string().min(1, 'Invalid song ID'),
  direction: z.enum(['up', 'down'], {
    message: 'Direction must be "up" or "down"',
  }),
});

// Upload schemas
export const uploadSongMetadataSchema = z.object({
  libraryId: z.string().min(1, 'Invalid library ID'),
  title: z.string().max(255).optional(),
  artist: z.string().max(255).optional(),
  album: z.string().max(255).optional(),
  albumArtist: z.string().max(255).optional(),
  year: z.number().int().min(1000).max(9999).optional(),
  genre: z.string().max(100).optional(),
  trackNumber: z.number().int().positive().optional(),
  discNumber: z.number().int().positive().optional(),
  composer: z.string().max(255).optional(),
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Authentication schemas
export const loginSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
