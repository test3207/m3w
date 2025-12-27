/**
 * Playlists Routes (Hono Backend)
 * User data routes - offline capable
 * 
 * @related When modifying routes, sync these files:
 * - shared/src/api-contracts.ts - Route definitions and offline capability
 * - frontend/src/lib/offline-proxy/routes/playlists.ts - Offline proxy handlers
 * - frontend/src/services/api/main/endpoints.ts - Frontend endpoint definitions
 * - frontend/src/services/api/main/resources/playlists.ts - Frontend API methods
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { getUserId } from '../lib/auth-helper';
import {
  createPlaylistSchema,
  updatePlaylistSchema,
  playlistIdSchema,
  addSongToPlaylistSchema,
  removeSongFromPlaylistSchema,
  toPlaylistResponse,
  toSongListResponse,
} from '@m3w/shared';
import type { Context } from 'hono';
import type { ApiResponse, Playlist, Song, PlaylistInput, PlaylistSongOperationResult, PlaylistReorderResult } from '@m3w/shared';
import {
  getPlaylistCoverSongId,
  findUserPlaylists,
  findPlaylistById,
  findPlaylistByLibrary,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  getPlaylistSongs,
  findUserSong,
  findPlaylistSong,
  addSongToPlaylist,
  removeSongFromPlaylist,
  getPlaylistSongIds,
  reorderPlaylistSongs,
  replacePlaylistSongs,
  validateLibrarySongs,
  createPlaylistSongs,
} from '../services/playlist.service';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// GET /api/playlists - List all playlists for current user
app.get('/', async (c: Context) => {
  const log = createLogger(c);
  try {
    const userId = getUserId(c);
    const playlists = await findUserPlaylists(userId);

    const response = playlists.map((pl) => {
      const firstSong = pl.songs[0]?.song;
      const input: PlaylistInput = {
        id: pl.id,
        name: pl.name,
        description: pl.description,
        userId: pl.userId,
        songCount: pl.songCount,
        linkedLibraryId: pl.linkedLibraryId,
        isDefault: pl.isDefault,
        canDelete: pl.canDelete,
        coverSongId: firstSong?.id ?? null,
        createdAt: pl.createdAt,
        updatedAt: pl.updatedAt,
      };
      return toPlaylistResponse(input);
    });

    return c.json<ApiResponse<Playlist[]>>({ success: true, data: response });
  } catch (error) {
    log.error({
      source: 'playlists.list',
      col1: 'playlist',
      col2: 'list',
      message: 'Failed to fetch playlists',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to fetch playlists' }, 500);
  }
});

// GET /api/playlists/by-library/:libraryId - Get playlist linked to library
// NOTE: Static routes must be defined BEFORE parameterized routes (/:id)
app.get('/by-library/:libraryId', async (c: Context) => {
  const log = createLogger(c);
  try {
    const userId = getUserId(c);
    const { libraryId } = c.req.param();

    const playlist = await findPlaylistByLibrary(userId, libraryId);

    if (!playlist) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Playlist not found' }, 404);
    }

    const input: PlaylistInput = {
      ...playlist,
      coverSongId: await getPlaylistCoverSongId(playlist.id),
    };

    return c.json<ApiResponse<Playlist>>({ success: true, data: toPlaylistResponse(input) });
  } catch (error) {
    log.error({
      source: 'playlists.by_library',
      col1: 'playlist',
      col2: 'get',
      col3: c.req.param('libraryId'),
      message: 'Failed to fetch library playlist',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to fetch library playlist' }, 500);
  }
});

// POST /api/playlists/for-library - Create playlist linked to library
// NOTE: Static routes must be defined BEFORE parameterized routes (/:id)
app.post('/for-library', async (c: Context) => {
  const log = createLogger(c);
  try {
    const userId = getUserId(c);
    const body = await c.req.json();
    const { name, linkedLibraryId, songIds } = body;

    // Validate library belongs to user
    const library = await prisma.library.findFirst({
      where: { id: linkedLibraryId, userId },
    });

    if (!library) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Library not found' }, 404);
    }

    const songCount = songIds?.length || 0;

    // Validate that all songs exist and belong to the linked library
    if (songIds && songIds.length > 0) {
      const isValid = await validateLibrarySongs(songIds, linkedLibraryId, userId);
      if (!isValid) {
        return c.json<ApiResponse<never>>({
          success: false,
          error: 'Invalid song IDs or songs do not belong to linked library',
        }, 400);
      }
    }

    // Create playlist
    const playlist = await createPlaylist({
      name,
      userId,
      linkedLibraryId,
      songCount,
      canDelete: false, // Library playlists cannot be manually deleted
    });

    // Create PlaylistSong entries
    if (songIds && songIds.length > 0) {
      await createPlaylistSongs(playlist.id, songIds);
    }

    log.info({
      source: 'playlists.for_library',
      col1: 'playlist',
      col2: 'create',
      col3: playlist.id,
      raw: { linkedLibraryId, songCount },
      message: 'Created library playlist',
    });

    const input: PlaylistInput = {
      ...playlist,
      coverSongId: await getPlaylistCoverSongId(playlist.id),
    };

    return c.json<ApiResponse<Playlist>>({ success: true, data: toPlaylistResponse(input) });
  } catch (error) {
    log.error({
      source: 'playlists.for_library',
      col1: 'playlist',
      col2: 'create',
      message: 'Failed to create library playlist',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to create library playlist' }, 500);
  }
});

// GET /api/playlists/:id - Get playlist by ID
app.get('/:id', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    const playlist = await findPlaylistById(id, userId);

    if (!playlist) {
      return c.json({ success: false, error: 'Playlist not found' }, 404);
    }

    const firstSong = playlist.songs[0]?.song;
    const input: PlaylistInput = {
      ...playlist,
      coverSongId: firstSong?.id ?? null,
    };

    return c.json<ApiResponse<Playlist>>({ success: true, data: toPlaylistResponse(input) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Invalid playlist ID', details: error.issues }, 400);
    }
    log.error({
      source: 'playlists.get',
      col1: 'playlist',
      col2: 'get',
      col3: c.req.param('id'),
      message: 'Failed to fetch playlist',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to fetch playlist' }, 500);
  }
});

// POST /api/playlists - Create new playlist
app.post('/', async (c: Context) => {
  const log = createLogger(c);
  try {
    const body = await c.req.json();
    const data = createPlaylistSchema.parse(body);
    const userId = getUserId(c);

    const playlist = await createPlaylist({
      name: data.name,
      description: data.description ?? undefined,
      userId,
      songCount: 0,
    });

    const input: PlaylistInput = { ...playlist, coverSongId: null };

    return c.json<ApiResponse<Playlist>>({ success: true, data: toPlaylistResponse(input) }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Validation failed', details: error.issues }, 400);
    }
    log.error({
      source: 'playlists.create',
      col1: 'playlist',
      col2: 'create',
      message: 'Failed to create playlist',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to create playlist' }, 500);
  }
});

// PATCH /api/playlists/:id - Update playlist
app.patch('/:id', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const data = updatePlaylistSchema.parse(body);
    const userId = getUserId(c);

    // Check if playlist exists and belongs to user
    const existingPlaylist = await prisma.playlist.findFirst({ where: { id, userId } });
    if (!existingPlaylist) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Playlist not found' }, 404);
    }

    const playlist = await updatePlaylist(id, {
      name: data.name,
      description: data.description ?? undefined,
    });

    const firstSong = playlist.songs[0]?.song;
    const input: PlaylistInput = {
      ...playlist,
      coverSongId: firstSong?.id ?? null,
    };

    return c.json<ApiResponse<Playlist>>({ success: true, data: toPlaylistResponse(input) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Validation failed', details: error.issues }, 400);
    }
    log.error({
      source: 'playlists.update',
      col1: 'playlist',
      col2: 'update',
      col3: c.req.param('id'),
      message: 'Failed to update playlist',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to update playlist' }, 500);
  }
});

// DELETE /api/playlists/:id - Delete playlist
app.delete('/:id', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    const existingPlaylist = await prisma.playlist.findFirst({ where: { id, userId } });
    if (!existingPlaylist) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Playlist not found' }, 404);
    }

    if (!existingPlaylist.canDelete) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Cannot delete default playlist' }, 403);
    }

    await deletePlaylist(id);

    return c.json<ApiResponse<undefined>>({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Invalid playlist ID', details: error.issues }, 400);
    }
    log.error({
      source: 'playlists.delete',
      col1: 'playlist',
      col2: 'delete',
      col3: c.req.param('id'),
      message: 'Failed to delete playlist',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to delete playlist' }, 500);
  }
});

// GET /api/playlists/:id/songs - Get songs in playlist
app.get('/:id/songs', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    const playlist = await prisma.playlist.findFirst({ where: { id, userId } });
    if (!playlist) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Playlist not found' }, 404);
    }

    const songs = await getPlaylistSongs(id);

    return c.json<ApiResponse<Song[]>>({ success: true, data: toSongListResponse(songs) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Invalid playlist ID', details: error.issues }, 400);
    }
    log.error({
      source: 'playlists.songs',
      col1: 'playlist',
      col2: 'get',
      col3: c.req.param('id'),
      message: 'Failed to fetch playlist songs',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to fetch playlist songs' }, 500);
  }
});

// POST /api/playlists/:id/songs - Add song to playlist
app.post('/:id/songs', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const { songId } = addSongToPlaylistSchema.parse(body);
    const userId = getUserId(c);

    const playlist = await prisma.playlist.findFirst({ where: { id, userId } });
    if (!playlist) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Playlist not found' }, 404);
    }

    const song = await findUserSong(songId, userId);
    if (!song) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Song not found' }, 404);
    }

    const existingEntry = await findPlaylistSong(id, songId);
    if (existingEntry) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Song is already in playlist' }, 400);
    }

    await addSongToPlaylist(id, songId);

    return c.json<ApiResponse<PlaylistSongOperationResult>>({
      success: true,
      data: { playlistId: id, songId, newSongCount: playlist.songCount + 1 },
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Validation failed', details: error.issues }, 400);
    }
    log.error({
      source: 'playlists.add_song',
      col1: 'playlist',
      col2: 'add_song',
      col3: c.req.param('id'),
      message: 'Failed to add song to playlist',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to add song to playlist' }, 500);
  }
});

// DELETE /api/playlists/:id/songs/:songId - Remove song from playlist
app.delete('/:id/songs/:songId', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const { songId } = removeSongFromPlaylistSchema.parse({ songId: c.req.param('songId') });
    const userId = getUserId(c);

    const playlist = await prisma.playlist.findFirst({ where: { id, userId } });
    if (!playlist) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Playlist not found' }, 404);
    }

    const existingEntry = await findPlaylistSong(id, songId);
    if (!existingEntry) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Song not found in playlist' }, 404);
    }

    await removeSongFromPlaylist(id, songId);

    return c.json<ApiResponse<PlaylistSongOperationResult>>({
      success: true,
      data: { playlistId: id, songId, newSongCount: playlist.songCount - 1 },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Validation failed', details: error.issues }, 400);
    }
    log.error({
      source: 'playlists.remove_song',
      col1: 'playlist',
      col2: 'remove_song',
      col3: c.req.param('id'),
      message: 'Failed to remove song from playlist',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to remove song from playlist' }, 500);
  }
});

// PUT /api/playlists/:id/songs/reorder - Reorder songs in playlist
app.put('/:id/songs/reorder', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const { songIds } = z.object({ songIds: z.array(z.string()) }).parse(body);
    const userId = getUserId(c);

    const playlist = await prisma.playlist.findFirst({ where: { id, userId } });
    if (!playlist) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Playlist not found' }, 404);
    }

    const existingSongIds = await getPlaylistSongIds(id);

    if (songIds.length !== existingSongIds.size) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: 'Song count mismatch - all songs must be included in reorder',
      }, 400);
    }

    for (const songId of songIds) {
      if (!existingSongIds.has(songId)) {
        return c.json<ApiResponse<never>>({
          success: false,
          error: 'Invalid song order - song not in playlist',
        }, 400);
      }
    }

    const updatedPlaylist = await reorderPlaylistSongs(id, songIds);

    log.debug({
      source: 'playlists.reorder',
      col1: 'playlist',
      col2: 'reorder',
      col3: id,
      raw: { songCount: songIds.length },
      message: 'Playlist songs reordered',
    });

    return c.json<ApiResponse<PlaylistReorderResult>>({
      success: true,
      data: {
        playlistId: id,
        songCount: songIds.length,
        updatedAt: updatedPlaylist.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Validation failed', details: error.issues }, 400);
    }
    log.error({
      source: 'playlists.reorder',
      col1: 'playlist',
      col2: 'reorder',
      col3: c.req.param('id'),
      message: 'Failed to reorder songs in playlist',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to reorder songs in playlist' }, 500);
  }
});

// PUT /api/playlists/:id/songs - Update playlist songs (batch)
app.put('/:id/songs', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);
    const body = await c.req.json();
    const { songIds } = body;

    const playlist = await prisma.playlist.findFirst({ where: { id, userId } });
    if (!playlist) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Playlist not found' }, 404);
    }

    await replacePlaylistSongs(id, songIds || []);

    log.info({
      source: 'playlists.update_songs',
      col1: 'playlist',
      col2: 'update',
      col3: id,
      raw: { songCount: songIds?.length || 0 },
      message: 'Updated playlist songs',
    });

    return c.json<ApiResponse<null>>({ success: true, data: null });
  } catch (error) {
    log.error({
      source: 'playlists.update_songs',
      col1: 'playlist',
      col2: 'update',
      col3: c.req.param('id'),
      message: 'Failed to update playlist songs',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to update playlist songs' }, 500);
  }
});

export default app;
