/**
 * Song routes for offline-proxy
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { db } from '../../db/schema';
import { deleteFromCache } from '../../pwa/cache-manager';

const app = new Hono();

// GET /songs/:id - Get song by ID
app.get('/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
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

    // Delete song from IndexedDB
    await db.songs.delete(id);

    // Remove song from all playlists
    const playlists = await db.playlists.toArray();
    for (const playlist of playlists) {
      if (playlist.songIds.includes(id)) {
        const newSongIds = playlist.songIds.filter(songId => songId !== id);
        await db.playlists.update(playlist.id, { songIds: newSongIds });
      }
    }

    // Delete cached audio file from Cache Storage
    try {
      await deleteFromCache(`/guest/songs/${id}/stream`);
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

// GET /songs/:id/stream - Deprecated
// Guest mode now uses /guest/songs/:id/stream served by Service Worker
// This route kept for backward compatibility but will return 404

export { app as songRoutes };
