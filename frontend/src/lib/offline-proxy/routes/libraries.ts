/**
 * Library routes for offline-proxy
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { db, markDirty, markDeleted } from '../../db/schema';
import type { OfflineLibrary } from '../../db/schema';
import { createLibrarySchema, updateLibrarySchema, toLibraryResponse } from '@m3w/shared';
import { getUserId, isGuestUser } from '../utils';
import { sortSongsOffline } from '../utils';

const app = new Hono();

// GET /libraries - List all libraries
app.get('/', async (c: Context) => {
  try {
    const userId = getUserId();
    const allLibraries = await db.libraries
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');
    // Filter out soft-deleted libraries
    const libraries = allLibraries.filter(lib => !lib._isDeleted);

    // Add song counts and coverUrl from last added song
    const librariesWithCounts = await Promise.all(
      libraries.map(async (library) => {
        // Filter out soft-deleted songs for count and cover
        const allSongs = await db.songs.where('libraryId').equals(library.id).toArray();
        const activeSongs = allSongs.filter(s => !s._isDeleted);
        const songCount = activeSongs.length;

        // Get last added song for cover (orderBy createdAt desc, matches backend)
        const sortedSongs = activeSongs.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const lastSong = sortedSongs[0];

        return {
          ...library,
          songCount,
          coverUrl: lastSong?.coverUrl || null,
        };
      })
    );

    return c.json({
      success: true,
      data: librariesWithCounts,
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

// GET /libraries/:id - Get library by ID
app.get('/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const library = await db.libraries.get(id);

    // Treat soft-deleted as not found
    if (!library || library._isDeleted) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    // Check ownership (skip for guest to allow access to guest's own libraries)
    if (library.userId !== userId && !isGuestUser()) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    // Add song count and coverUrl from last added song
    const songCount = await db.songs.where('libraryId').equals(id).count();

    // Get last added song for cover (matches backend)
    const lastSong = await db.songs
      .where('libraryId')
      .equals(id)
      .reverse()
      .sortBy('createdAt')
      .then((songs) => songs[0]);

    const libraryWithCount = {
      ...library,
      songCount,
      coverUrl: lastSong?.coverUrl || null,
    };

    return c.json({
      success: true,
      data: libraryWithCount,
    });
  } catch (error) {
    console.error('[OfflineProxy] GET /libraries/:id error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch library',
      },
      500
    );
  }
});

// POST /libraries - Create new library
app.post('/', async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createLibrarySchema.parse(body);
    const userId = getUserId();

    const libraryData: OfflineLibrary = {
      id: crypto.randomUUID(),
      ...data,
      description: data.description ?? null,
      userId,
      songCount: 0,
      isDefault: false,
      canDelete: true,
      coverUrl: null, // New library has no songs yet
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // isNew=true marks this as a local-only entity (needs ID mapping on sync)
    const library = markDirty(libraryData, true);

    await db.libraries.add(library);

    // Transform to API response format
    return c.json(
      {
        success: true,
        data: toLibraryResponse(library),
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

// PATCH /libraries/:id - Update library
app.patch('/:id', async (c: Context) => {
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

    const updated: OfflineLibrary = markDirty({
      ...library,
      ...data,
      updatedAt: new Date().toISOString(),
    });

    await db.libraries.put(updated);

    return c.json({
      success: true,
      data: toLibraryResponse(updated),
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

// DELETE /libraries/:id - Delete library
app.delete('/:id', async (c: Context) => {
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

    if (isGuestUser()) {
      // Guest user: hard delete with cascade (no sync needed)
      // Delete all songs in this library
      await db.songs.where('libraryId').equals(id).delete();
      // Clear linkedLibraryId from playlists (don't delete playlists, just unlink)
      await db.playlists.where('linkedLibraryId').equals(id).modify({ linkedLibraryId: undefined });
      // Delete the library itself
      await db.libraries.delete(id);
    } else {
      // Auth user: soft delete for sync (server will cascade delete)
      await db.libraries.put(markDeleted(library));
    }

    return c.json({
      success: true,
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

// GET /libraries/:id/songs - Get songs in library
app.get('/:id/songs', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();
    const sortParam = (c.req.query('sort') || 'date-desc') as string;

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

    // Query songs by libraryId (one-to-many relationship)
    // Filter out soft-deleted songs
    const allSongs = await db.songs.where('libraryId').equals(id).toArray();
    const songs = allSongs.filter(song => !song._isDeleted);

    // Apply sorting (matches backend logic)
    const sortedSongs = sortSongsOffline(songs, sortParam);

    return c.json({
      success: true,
      data: sortedSongs,
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

export { app as libraryRoutes };
