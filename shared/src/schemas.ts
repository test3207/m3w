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

// Playlist schemas
export const createPlaylistSchema = z.object({
  name: z.string().min(1, 'Playlist name is required').max(255),
  description: z.string().max(1000).optional().nullable(),
});

export const updatePlaylistSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
});

// Song schemas
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

// Playlist-Song operations
export const reorderPlaylistSongSchema = z.object({
  songId: z.string().min(1, 'Invalid song ID'),
  direction: z.enum(['up', 'down'], {
    message: 'Direction must be "up" or "down"',
  }),
});

// Schemas removed (unused):
// - libraryIdSchema, playlistIdSchema, songIdSchema
// - createSongSchema, addSongToPlaylistSchema, removeSongFromPlaylistSchema
// - uploadSongMetadataSchema, paginationSchema
// - loginSchema, refreshTokenSchema
// These can be added back when needed for specific features
