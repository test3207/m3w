/**
 * Song routes for offline-proxy
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { db } from '../../db/schema';

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

// GET /songs/:id/stream - Deprecated
// Guest mode now uses /guest/songs/:id/stream served by Service Worker
// This route kept for backward compatibility but will return 404

export { app as songRoutes };
