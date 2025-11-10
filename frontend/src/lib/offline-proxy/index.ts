/**
 * Offline Proxy with Hono
 * Handles user data routes (libraries, playlists, songs) with IndexedDB
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { db, addToSyncQueue } from '../db/schema';
import type { OfflineLibrary, OfflinePlaylist } from '../db/schema';
import {
  createLibrarySchema,
  updateLibrarySchema,
  createPlaylistSchema,
  updatePlaylistSchema,
} from '@m3w/shared';

const app = new Hono();

// Helper to get userId from auth store
function getUserId(): string {
  // Zustand persist uses 'auth-storage' as the key name
  const authState = localStorage.getItem('auth-storage');
  if (!authState) {
    throw new Error('Not authenticated');
  }
  const { user } = JSON.parse(authState).state;
  return user?.id || '';
}

// ============================================
// Libraries Routes
// ============================================

// GET /api/libraries - List all libraries
app.get('/libraries', async (c: Context) => {
  try {
    const userId = getUserId();
    const libraries = await db.libraries
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');

    return c.json({
      success: true,
      data: libraries,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch libraries',
      },
      500
    );
  }
});

// GET /api/libraries/:id - Get library by ID
app.get('/libraries/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library || library.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: library,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch library',
      },
      500
    );
  }
});

// POST /api/libraries - Create new library
app.post('/libraries', async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createLibrarySchema.parse(body);
    const userId = getUserId();

    const library: OfflineLibrary = {
      id: crypto.randomUUID(),
      ...data,
      description: data.description ?? null,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      _syncStatus: 'pending',
    };

    await db.libraries.add(library);
    await addToSyncQueue({
      entityType: 'library',
      entityId: library.id,
      operation: 'create',
      data: library,
    });

    return c.json(
      {
        success: true,
        data: library,
        message: 'Library created (will sync when online)',
      },
      201
    );
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to create library',
      },
      500
    );
  }
});

// PATCH /api/libraries/:id - Update library
app.patch('/libraries/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const data = updateLibrarySchema.parse(body);
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library || library.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    const updated: OfflineLibrary = {
      ...library,
      ...data,
      updatedAt: new Date(),
      _syncStatus: 'pending',
    };

    await db.libraries.put(updated);
    await addToSyncQueue({
      entityType: 'library',
      entityId: id,
      operation: 'update',
      data: updated,
    });

    return c.json({
      success: true,
      data: updated,
      message: 'Library updated (will sync when online)',
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to update library',
      },
      500
    );
  }
});

// DELETE /api/libraries/:id - Delete library
app.delete('/libraries/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library || library.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    await db.libraries.delete(id);
    await addToSyncQueue({
      entityType: 'library',
      entityId: id,
      operation: 'delete',
    });

    return c.json({
      success: true,
      message: 'Library deleted (will sync when online)',
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to delete library',
      },
      500
    );
  }
});

// GET /api/libraries/:id/songs - Get songs in library
app.get('/libraries/:id/songs', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library || library.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    const songs = await db.songs.where('libraryId').equals(id).toArray();

    return c.json({
      success: true,
      data: songs,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch songs',
      },
      500
    );
  }
});

// ============================================
// Playlists Routes
// ============================================

// GET /api/playlists - List all playlists
app.get('/playlists', async (c: Context) => {
  try {
    const userId = getUserId();
    const playlists = await db.playlists
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');

    return c.json({
      success: true,
      data: playlists,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch playlists',
      },
      500
    );
  }
});

// GET /api/playlists/:id - Get playlist by ID
app.get('/playlists/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: playlist,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch playlist',
      },
      500
    );
  }
});

// POST /api/playlists - Create new playlist
app.post('/playlists', async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createPlaylistSchema.parse(body);
    const userId = getUserId();

    const playlist: OfflinePlaylist = {
      id: crypto.randomUUID(),
      ...data,
      description: data.description ?? null,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      _syncStatus: 'pending',
    };

    await db.playlists.add(playlist);
    await addToSyncQueue({
      entityType: 'playlist',
      entityId: playlist.id,
      operation: 'create',
      data: playlist,
    });

    return c.json(
      {
        success: true,
        data: playlist,
        message: 'Playlist created (will sync when online)',
      },
      201
    );
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to create playlist',
      },
      500
    );
  }
});

// PATCH /api/playlists/:id - Update playlist
app.patch('/playlists/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const data = updatePlaylistSchema.parse(body);
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    const updated: OfflinePlaylist = {
      ...playlist,
      ...data,
      updatedAt: new Date(),
      _syncStatus: 'pending',
    };

    await db.playlists.put(updated);
    await addToSyncQueue({
      entityType: 'playlist',
      entityId: id,
      operation: 'update',
      data: updated,
    });

    return c.json({
      success: true,
      data: updated,
      message: 'Playlist updated (will sync when online)',
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to update playlist',
      },
      500
    );
  }
});

// DELETE /api/playlists/:id - Delete playlist
app.delete('/playlists/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    await db.playlists.delete(id);
    await addToSyncQueue({
      entityType: 'playlist',
      entityId: id,
      operation: 'delete',
    });

    return c.json({
      success: true,
      message: 'Playlist deleted (will sync when online)',
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to delete playlist',
      },
      500
    );
  }
});

// ============================================
// Songs Routes
// ============================================

// GET /api/songs/:id - Get song by ID
app.get('/songs/:id', async (c: Context) => {
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

export default app;
