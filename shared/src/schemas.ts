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
  id: z.string().uuid('Invalid library ID'),
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
  id: z.string().uuid('Invalid playlist ID'),
});

// Song schemas
export const createSongSchema = z.object({
  title: z.string().min(1, 'Song title is required').max(255),
  artist: z.string().max(255).optional().nullable(),
  album: z.string().max(255).optional().nullable(),
  duration: z.number().int().positive().optional().nullable(),
  fileHash: z.string().min(1, 'File hash is required'),
  libraryId: z.string().uuid('Invalid library ID'),
});

export const updateSongSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  artist: z.string().max(255).optional().nullable(),
  album: z.string().max(255).optional().nullable(),
  duration: z.number().int().positive().optional().nullable(),
});

export const songIdSchema = z.object({
  id: z.string().uuid('Invalid song ID'),
});

// Playlist-Song association schemas
export const addSongToPlaylistSchema = z.object({
  songId: z.string().uuid('Invalid song ID'),
  position: z.number().int().nonnegative().optional(),
});

export const removeSongFromPlaylistSchema = z.object({
  songId: z.string().uuid('Invalid song ID'),
});

// Upload schemas
export const uploadSongMetadataSchema = z.object({
  libraryId: z.string().uuid('Invalid library ID'),
  title: z.string().max(255).optional(),
  artist: z.string().max(255).optional(),
  album: z.string().max(255).optional(),
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
