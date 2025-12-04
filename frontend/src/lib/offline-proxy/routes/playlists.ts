/**
 * Playlist routes for offline-proxy
 * 
 * Data storage strategy:
 * - Playlist metadata stored in `playlists` table
 * - Song relationships stored in `playlistSongs` table (junction table)
 * - songIds computed from playlistSongs for API response compatibility
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { db, markDirty, markDeleted } from '../../db/schema';
import type { OfflinePlaylist, OfflinePlaylistSong } from '../../db/schema';
import {
  createPlaylistSchema,
  updatePlaylistSchema,
  toPlaylistResponse,
} from '@m3w/shared';
import type { ApiResponse, PlaylistReorderResult } from '@m3w/shared';
import { getUserId, isGuestUser } from '../utils';
import { logger } from '../../logger-client';

const app = new Hono();

/**
 * Helper: Get songIds array from PlaylistSong table (ordered by order field)
 */
async function getPlaylistSongIds(playlistId: string): Promise<string[]> {
  const playlistSongs = await db.playlistSongs
    .where('playlistId')
    .equals(playlistId)
    .toArray();
  // Filter soft-deleted and sort by order
  return playlistSongs
    .filter(ps => !ps._isDeleted)
    .sort((a, b) => a.order - b.order)
    .map(ps => ps.songId);
}

/**
 * Helper: Get first song's cover URL for a playlist
 */
async function getPlaylistCoverUrl(playlistId: string): Promise<string | null> {
  const playlistSongs = await db.playlistSongs
    .where('playlistId')
    .equals(playlistId)
    .toArray();
  const activeSongs = playlistSongs
    .filter(ps => !ps._isDeleted)
    .sort((a, b) => a.order - b.order);
  
  const firstPlaylistSong = activeSongs[0];
  if (!firstPlaylistSong) return null;
  
  const song = await db.songs.get(firstPlaylistSong.songId);
  return (song && !song._isDeleted) ? song.coverUrl || null : null;
}

// GET /playlists - List all playlists
app.get('/', async (c: Context) => {
  try {
    const userId = getUserId();
    const allPlaylists = await db.playlists
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');
    // Filter out soft-deleted playlists
    const playlists = allPlaylists.filter(pl => !pl._isDeleted);

    // Add song counts, songIds, and coverUrl
    const playlistsWithData = await Promise.all(
      playlists.map(async (playlist) => {
        const songIds = await getPlaylistSongIds(playlist.id);
        const coverUrl = await getPlaylistCoverUrl(playlist.id);

        return {
          ...playlist,
          songIds,
          songCount: songIds.length,
          coverUrl,
        };
      })
    );

    return c.json({
      success: true,
      data: playlistsWithData,
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

    // Find playlist with linkedLibraryId (exclude soft-deleted)
    const allMatching = await db.playlists
      .where('linkedLibraryId')
      .equals(libraryId)
      .toArray();
    const playlist = allMatching.find(pl => !pl._isDeleted);

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

    // Get songIds from PlaylistSong table
    const songIds = await getPlaylistSongIds(playlist.id);

    return c.json({
      success: true,
      data: {
        ...playlist,
        songIds,
        songCount: songIds.length,
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

    const songCount = songIds?.length || 0;
    const playlistData: OfflinePlaylist = {
      id: crypto.randomUUID(),
      name,
      description: null,
      userId,
      songCount,
      linkedLibraryId,
      isDefault: false,
      canDelete: true,
      coverUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // isNew=true marks this as a local-only entity (needs ID mapping on sync)
    const playlist = markDirty(playlistData, true);

    await db.playlists.add(playlist);

    // Add playlist songs
    if (songIds && songIds.length > 0) {
      const playlistSongsData: OfflinePlaylistSong[] = songIds.map((songId: string, index: number) => ({
        playlistId: playlist.id,
        songId,
        order: index,
        addedAt: new Date().toISOString(),
      }));
      await db.playlistSongs.bulkAdd(playlistSongsData.map(ps => markDirty(ps)));
    }

    return c.json(
      {
        success: true,
        data: {
          ...playlist,
          songIds: songIds || [],
        },
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

    // Treat soft-deleted as not found
    if (!playlist || playlist._isDeleted || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Get songIds and coverUrl
    const songIds = await getPlaylistSongIds(id);
    const coverUrl = await getPlaylistCoverUrl(id);

    return c.json({
      success: true,
      data: {
        ...playlist,
        songIds,
        songCount: songIds.length,
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

    const playlistData: OfflinePlaylist = {
      id: crypto.randomUUID(),
      ...data,
      description: data.description ?? null,
      userId,
      songCount: 0,
      linkedLibraryId: null,
      isDefault: false,
      canDelete: true,
      coverUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // isNew=true marks this as a local-only entity (needs ID mapping on sync)
    const playlist = markDirty(playlistData, true);

    await db.playlists.add(playlist);

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

    const updatedData: OfflinePlaylist = {
      ...playlist,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const updated = markDirty(updatedData);

    await db.playlists.put(updated);

    // Get songCount for response
    const songIds = await getPlaylistSongIds(id);

    return c.json({
      success: true,
      data: toPlaylistResponse({
        ...updated,
        songCount: songIds.length,
      }),
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

    if (isGuestUser()) {
      // Guest user: hard delete immediately (no sync needed)
      await db.playlists.delete(id);
      // Also delete all playlistSongs for this playlist
      await db.playlistSongs.where('playlistId').equals(id).delete();
    } else {
      // Auth user: soft delete for sync
      await db.playlists.put(markDeleted(playlist));
      // Also soft-delete all playlistSongs
      const playlistSongs = await db.playlistSongs.where('playlistId').equals(id).toArray();
      await Promise.all(playlistSongs.map(ps => db.playlistSongs.put(markDeleted(ps))));
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

    // Get playlist songs from IndexedDB (filter soft-deleted, sort by order)
    const allPlaylistSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .toArray();
    const playlistSongs = allPlaylistSongs
      .filter(ps => !ps._isDeleted)
      .sort((a, b) => a.order - b.order);

    // Get full song details with library name
    const songs = await Promise.all(
      playlistSongs.map(async (ps) => {
        const song = await db.songs.get(ps.songId);
        // Skip if song not found or soft-deleted
        if (!song || song._isDeleted) return undefined;

        // Get library name if not already present on song
        let libraryName = song.libraryName;
        if (!libraryName && song.libraryId) {
          const library = await db.libraries.get(song.libraryId);
          libraryName = library?.name ?? null;
        }

        return {
          ...song,
          libraryName,
        };
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

    // Check if song already in playlist
    const existingEntry = await db.playlistSongs
      .where('[playlistId+songId]')
      .equals([id, songId])
      .first();

    if (existingEntry && !existingEntry._isDeleted) {
      return c.json(
        {
          success: false,
          error: 'Song is already in playlist',
        },
        400
      );
    }

    // Get current max order
    const existingSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .toArray();
    const activeSongs = existingSongs.filter(ps => !ps._isDeleted);
    const maxOrder = activeSongs.length > 0
      ? Math.max(...activeSongs.map((ps) => ps.order))
      : -1;

    // Add to playlist
    const playlistSongData: OfflinePlaylistSong = {
      playlistId: id,
      songId,
      order: maxOrder + 1,
      addedAt: new Date().toISOString(),
    };
    const playlistSong = markDirty(playlistSongData);

    if (existingEntry) {
      // Re-activate soft-deleted entry
      await db.playlistSongs.put({
        ...existingEntry,
        ...playlistSong,
        _isDeleted: false,
      });
    } else {
      await db.playlistSongs.add(playlistSong);
    }

    // Get new song count
    const newSongCount = activeSongs.length + 1;

    // Update playlist timestamp and songCount
    await db.playlists.update(id, {
      songCount: newSongCount,
      updatedAt: new Date().toISOString(),
    });

    // Return response matching backend format
    return c.json(
      {
        success: true,
        data: {
          playlistId: id,
          songId,
          newSongCount,
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

    // Update playlistSongs order field using bulkPut for efficiency
    const allPlaylistSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .toArray();

    // Create updated entries with new order
    const orderMap = new Map(songIds.map((songId, index) => [songId, index]));
    const updatedEntries = allPlaylistSongs
      .filter(ps => !ps._isDeleted)
      .map(ps => {
        const newOrder = orderMap.get(ps.songId);
        if (newOrder !== undefined) {
          return markDirty({ ...ps, order: newOrder });
        }
        return ps;
      });

    // Bulk update
    await db.playlistSongs.bulkPut(updatedEntries);

    // Update playlist timestamp
    await db.playlists.update(id, {
      updatedAt: new Date().toISOString(),
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

    // Use transaction for atomicity
    await db.transaction('rw', db.playlistSongs, db.playlists, async () => {
      // Delete existing playlist songs
      const existingSongs = await db.playlistSongs
        .where('playlistId')
        .equals(id)
        .toArray();
      
      if (isGuestUser()) {
        // Hard delete for guest
        await Promise.all(existingSongs.map((ps) => 
          db.playlistSongs.delete([ps.playlistId, ps.songId])
        ));
      } else {
        // Soft delete for auth users
        await Promise.all(existingSongs.map((ps) => 
          db.playlistSongs.put(markDeleted(ps))
        ));
      }

      // Add new songs
      if (songIds && songIds.length > 0) {
        const playlistSongsData: OfflinePlaylistSong[] = songIds.map((songId: string, index: number) => ({
          playlistId: id,
          songId,
          order: index,
          addedAt: new Date().toISOString(),
        }));
        await db.playlistSongs.bulkPut(playlistSongsData.map(ps => markDirty(ps)));
      }

      // Update playlist timestamp and songCount
      await db.playlists.update(id, {
        songCount: songIds?.length || 0,
        updatedAt: new Date().toISOString(),
      });
    });

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

    if (!playlistSong || playlistSong._isDeleted) {
      return c.json(
        {
          success: false,
          error: 'Song not in playlist',
        },
        404
      );
    }

    // Get current song count before deletion
    const allPlaylistSongs = await db.playlistSongs
      .where('playlistId')
      .equals(playlistId)
      .toArray();
    const currentCount = allPlaylistSongs.filter(ps => !ps._isDeleted).length;

    if (isGuestUser()) {
      // Guest user: hard delete immediately
      await db.playlistSongs.delete([playlistSong.playlistId, playlistSong.songId]);
    } else {
      // Auth user: soft delete for sync
      await db.playlistSongs.put(markDeleted(playlistSong));
    }

    const newSongCount = currentCount - 1;

    // Update playlist timestamp and songCount
    await db.playlists.update(playlistId, {
      songCount: Math.max(0, newSongCount),
      updatedAt: new Date().toISOString(),
    });

    // Return response matching backend format
    return c.json({
      success: true,
      data: {
        playlistId,
        songId,
        newSongCount,
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
