/**
 * Playlist routes for offline-proxy
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { db, addToSyncQueue } from '../../db/schema';
import type { OfflinePlaylist } from '../../db/schema';
import {
  createPlaylistSchema,
  updatePlaylistSchema,
  toPlaylistResponse,
} from '@m3w/shared';
import type { ApiResponse, PlaylistReorderResult } from '@m3w/shared';
import { getUserId } from '../utils';
import { logger } from '../../logger-client';

const app = new Hono();

// GET /playlists - List all playlists
app.get('/', async (c: Context) => {
  try {
    const userId = getUserId();
    const playlists = await db.playlists
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');

    // Add song counts and coverUrl from first song (by order)
    const playlistsWithCounts = await Promise.all(
      playlists.map(async (playlist) => {
        const songCount = await db.playlistSongs
          .where('playlistId')
          .equals(playlist.id)
          .count();

        // Get first song by order for cover (matches backend)
        const firstPlaylistSong = await db.playlistSongs
          .where('playlistId')
          .equals(playlist.id)
          .sortBy('order')
          .then((pSongs) => pSongs[0]);

        let coverUrl: string | null = null;
        if (firstPlaylistSong) {
          const song = await db.songs.get(firstPlaylistSong.songId);
          coverUrl = song?.coverUrl || null;
        }

        return {
          ...playlist,
          _count: {
            songs: songCount,
          },
          coverUrl,
        };
      })
    );

    return c.json({
      success: true,
      data: playlistsWithCounts,
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

// GET /playlists/by-library/:libraryId - Get playlist linked to library
// Note: This route must be defined BEFORE /:id to avoid conflict
app.get('/by-library/:libraryId', async (c: Context) => {
  try {
    const libraryId = c.req.param('libraryId');
    const userId = getUserId();

    // Find playlist with linkedLibraryId
    const playlist = await db.playlists
      .where('linkedLibraryId')
      .equals(libraryId)
      .first();

    if (!playlist) {
      return c.json({
        success: true,
        data: null,
      });
    }

    if (playlist.userId !== userId) {
      return c.json({
        success: true,
        data: null,
      });
    }

    // Add song count
    const songCount = await db.playlistSongs
      .where('playlistId')
      .equals(playlist.id)
      .count();

    return c.json({
      success: true,
      data: {
        ...playlist,
        _count: {
          songs: songCount,
        },
      },
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch library playlist',
      },
      500
    );
  }
});

// POST /playlists/for-library - Create playlist linked to library
app.post('/for-library', async (c: Context) => {
  try {
    const body = await c.req.json();
    const { name, linkedLibraryId, songIds } = body;
    const userId = getUserId();

    const playlist: OfflinePlaylist = {
      id: crypto.randomUUID(),
      name,
      description: null,
      userId,
      songIds: songIds || [],
      linkedLibraryId,
      isDefault: false,
      canDelete: true,
      coverUrl: null, // Will be computed from first song
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { songs: songIds?.length || 0 },
      _syncStatus: 'pending',
    };

    await db.playlists.add(playlist);

    // Add playlist songs (align with backend: no fromLibraryId needed)
    if (songIds && songIds.length > 0) {
      await Promise.all(
        songIds.map((songId: string, index: number) =>
          db.playlistSongs.add({
            id: crypto.randomUUID(),
            playlistId: playlist.id,
            songId,
            order: index + 1,
            addedAt: new Date(),
            _syncStatus: 'pending' as const,
          })
        )
      );
    }

    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlist',
        entityId: playlist.id,
        operation: 'create',
        data: playlist,
      });
    }

    return c.json(
      {
        success: true,
        data: playlist,
      },
      201
    );
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to create library playlist',
      },
      500
    );
  }
});

// GET /playlists/:id - Get playlist by ID
app.get('/:id', async (c: Context) => {
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

    // Add song count and coverUrl from first song (by order)
    const songCount = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .count();

    // Get first song by order for cover (matches backend)
    const firstPlaylistSong = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .sortBy('order')
      .then((pSongs) => pSongs[0]);

    let coverUrl: string | null = null;
    if (firstPlaylistSong) {
      const song = await db.songs.get(firstPlaylistSong.songId);
      coverUrl = song?.coverUrl || null;
    }

    return c.json({
      success: true,
      data: {
        ...playlist,
        _count: {
          songs: songCount,
        },
        coverUrl,
      },
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

// POST /playlists - Create new playlist
app.post('/', async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createPlaylistSchema.parse(body);
    const userId = getUserId();

    const playlist: OfflinePlaylist = {
      id: crypto.randomUUID(),
      ...data,
      description: data.description ?? null,
      userId,
      songIds: [],
      linkedLibraryId: null,
      isDefault: false,
      canDelete: true,
      coverUrl: null, // New playlist has no songs yet
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { songs: 0 },
      _syncStatus: 'pending',
    };

    await db.playlists.add(playlist);

    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlist',
        entityId: playlist.id,
        operation: 'create',
        data: playlist,
      });
    }

    // Transform to API response format
    return c.json(
      {
        success: true,
        data: toPlaylistResponse(playlist),
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

// PATCH /playlists/:id - Update playlist
app.patch('/:id', async (c: Context) => {
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
      updatedAt: new Date().toISOString(),
      _syncStatus: 'pending',
    };

    await db.playlists.put(updated);

    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlist',
        entityId: id,
        operation: 'update',
        data: updated,
      });
    }

    return c.json({
      success: true,
      data: toPlaylistResponse(updated),
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

// DELETE /playlists/:id - Delete playlist
app.delete('/:id', async (c: Context) => {
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

    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlist',
        entityId: id,
        operation: 'delete',
      });
    }

    return c.json({
      success: true,
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

// GET /playlists/:id/songs - Get songs in playlist
app.get('/:id/songs', async (c: Context) => {
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

    // Get playlist songs from IndexedDB
    const playlistSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .sortBy('order');

    // Get full song details
    const songs = await Promise.all(
      playlistSongs.map(async (ps) => {
        const song = await db.songs.get(ps.songId);
        return song;
      })
    );

    // Filter out any songs that weren't found
    const validSongs = songs.filter((song) => song !== undefined);

    return c.json({
      success: true,
      data: validSongs,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch playlist songs',
      },
      500
    );
  }
});

// POST /playlists/:id/songs - Add song to playlist
app.post('/:id/songs', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { songId } = body;
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

    const song = await db.songs.get(songId);

    if (!song) {
      return c.json(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }

    // Get current max order
    const existingSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .toArray();

    const maxOrder =
      existingSongs.length > 0
        ? Math.max(...existingSongs.map((ps) => ps.order))
        : 0;

    // Add to playlist (align with backend: no fromLibraryId)
    const playlistSong = {
      id: crypto.randomUUID(),
      playlistId: id,
      songId,
      order: maxOrder + 1,
      addedAt: new Date(),
      _syncStatus: 'pending' as const,
    };

    await db.playlistSongs.add(playlistSong);

    // Update playlist.songIds array to match backend behavior
    // Also update coverUrl if playlist was empty (first song added)
    const updatedSongIds = [...playlist.songIds, songId];
    const wasEmpty = playlist.songIds.length === 0;
    await db.playlists.update(id, {
      songIds: updatedSongIds,
      updatedAt: new Date().toISOString(),
      // Update coverUrl if this is the first song
      ...(wasEmpty && song.coverUrl ? { coverUrl: song.coverUrl } : {}),
    });

    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlistSong',
        entityId: playlistSong.id,
        operation: 'create',
        data: playlistSong,
      });
    }

    // Return response matching backend format
    return c.json(
      {
        success: true,
        data: {
          playlistId: id,
          songId,
          newSongCount: updatedSongIds.length,
        },
      },
      201
    );
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to add song to playlist',
      },
      500
    );
  }
});

// PUT /playlists/:id/songs/reorder - Reorder songs in playlist
app.put('/:id/songs/reorder', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();
    const body = await c.req.json();
    const { songIds } = body as { songIds: string[] };

    // Check if playlist exists and belongs to user
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

    // Validate that all songIds exist
    const songs = await db.songs.bulkGet(songIds);
    const validSongIds = songs.filter((s) => s !== undefined).map((s) => s!.id);

    if (validSongIds.length !== songIds.length) {
      return c.json(
        {
          success: false,
          error: 'Invalid song order',
        },
        400
      );
    }

    // Update playlist with new order
    await db.playlists.update(id, {
      songIds,
      updatedAt: new Date().toISOString(),
    });

    // Update playlistSongs order field to match new songIds order
    const playlistSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .toArray();

    // Create a map of songId to new order
    const orderMap = new Map(songIds.map((songId, index) => [songId, index]));

    // Update each playlistSong's order field
    await db.transaction('rw', db.playlistSongs, async () => {
      for (const ps of playlistSongs) {
        const newOrder = orderMap.get(ps.songId);
        if (newOrder !== undefined) {
          await db.playlistSongs.update(ps.id, { order: newOrder });
        }
      }
    });

    return c.json<ApiResponse<PlaylistReorderResult>>({
      success: true,
      data: {
        playlistId: id,
        songCount: songIds.length,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to reorder songs in playlist', { error });
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to reorder songs in playlist',
      },
      500
    );
  }
});

// PUT /playlists/:id/songs - Update playlist songs (batch)
app.put('/:id/songs', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { songIds } = body;
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

    // Delete existing playlist songs
    const existingSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .toArray();
    await Promise.all(existingSongs.map((ps) => db.playlistSongs.delete(ps.id)));

    // Add new songs (align with backend: no fromLibraryId)
    if (songIds && songIds.length > 0) {
      await Promise.all(
        songIds.map((songId: string, index: number) =>
          db.playlistSongs.add({
            id: crypto.randomUUID(),
            playlistId: id,
            songId,
            order: index + 1,
            addedAt: new Date(),
            _syncStatus: 'pending' as const,
          })
        )
      );
    }

    // Update playlist songIds
    const updated: OfflinePlaylist = {
      ...playlist,
      songIds,
      updatedAt: new Date().toISOString(),
      _syncStatus: 'pending',
    };
    await db.playlists.put(updated);

    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlist',
        entityId: id,
        operation: 'update',
        data: updated,
      });
    }

    return c.json({
      success: true,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to update playlist songs',
      },
      500
    );
  }
});

// DELETE /playlists/:id/songs/:songId - Remove song from playlist
app.delete('/:id/songs/:songId', async (c: Context) => {
  try {
    const playlistId = c.req.param('id');
    const songId = c.req.param('songId');
    const userId = getUserId();

    const playlist = await db.playlists.get(playlistId);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Find the playlist song entry
    const playlistSong = await db.playlistSongs
      .where('[playlistId+songId]')
      .equals([playlistId, songId])
      .first();

    if (!playlistSong) {
      return c.json(
        {
          success: false,
          error: 'Song not in playlist',
        },
        404
      );
    }

    await db.playlistSongs.delete(playlistSong.id);

    // Update playlist.songIds array to match backend behavior
    const updatedSongIds = playlist.songIds.filter((id) => id !== songId);
    await db.playlists.update(playlistId, {
      songIds: updatedSongIds,
      updatedAt: new Date().toISOString(),
    });

    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlistSong',
        entityId: playlistSong.id,
        operation: 'delete',
      });
    }

    // Return response matching backend format
    return c.json({
      success: true,
      data: {
        playlistId,
        songId,
        newSongCount: updatedSongIds.length,
      },
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to remove song from playlist',
      },
      500
    );
  }
});

export { app as playlistRoutes };
