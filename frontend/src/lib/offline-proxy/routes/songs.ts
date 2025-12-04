/**
 * Song routes for offline-proxy
 * 
 * All cache operations use /api/ URLs.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { db, markDeleted } from '../../db/schema';
import { deleteFromCache } from '../../pwa/cache-manager';
import { isGuestUser } from '../utils';

const app = new Hono();

// GET /songs/:id - Get song by ID
app.get('/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const song = await db.songs.get(id);

    // Treat soft-deleted as not found
    if (!song || song._isDeleted) {
      return c.json(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: song,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch song',
      },
      500
    );
  }
});

// DELETE /songs/:id - Delete song from library
// Query param: libraryId (required)
app.delete('/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const libraryId = c.req.query('libraryId');

    if (!libraryId) {
      return c.json(
        {
          success: false,
          error: 'libraryId is required',
        },
        400
      );
    }

    // Get song to check if it exists and belongs to the library
    const song = await db.songs.get(id);

    if (!song) {
      return c.json(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }

    if (song.libraryId !== libraryId) {
      return c.json(
        {
          success: false,
          error: 'Song does not belong to this library',
        },
        403
      );
    }

    if (isGuestUser()) {
      // Guest user: hard delete immediately (no sync needed)
      await db.songs.delete(id);
      
      // Hard delete playlistSongs referencing this song
      await db.playlistSongs.where('songId').equals(id).delete();
    } else {
      // Auth user: soft delete for sync
      await db.songs.put(markDeleted(song));
      
      // Soft delete playlistSongs referencing this song
      const playlistSongs = await db.playlistSongs.where('songId').equals(id).toArray();
      await Promise.all(playlistSongs.map(ps => db.playlistSongs.put(markDeleted(ps))));
    }

    // Note: PlaylistSong entries are already deleted above, no need to update songIds array
    // (songIds is now computed from PlaylistSong table)

    // Delete cached audio file from Cache Storage
    try {
      await deleteFromCache(`/api/songs/${id}/stream`);
    } catch (cacheError) {
      // Log but don't fail - audio may not be cached
      console.warn('[offline-proxy] Failed to delete cached audio:', cacheError);
    }

    // Delete cached cover from Cache Storage if exists
    if (song.coverUrl) {
      try {
        await deleteFromCache(song.coverUrl);
      } catch {
        // Cover may not be in cache
      }
    }

    return c.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error('[offline-proxy] Failed to delete song:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to delete song',
      },
      500
    );
  }
});

// GET /songs/:id/stream - Not needed
// Service Worker serves cached files directly from Cache Storage

export { app as songRoutes };
