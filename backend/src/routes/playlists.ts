import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { resolveCoverUrl } from '../lib/cover-url-helper';
import { getUserId } from '../lib/auth-helper';
import {
  createPlaylistSchema,
  updatePlaylistSchema,
  playlistIdSchema,
  addSongToPlaylistSchema,
  removeSongFromPlaylistSchema,
} from '@m3w/shared';
import type { Context } from 'hono';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// GET /api/playlists - List all playlists for current user
app.get('/', async (c: Context) => {
  try {
    const userId = getUserId(c);

    const playlists = await prisma.playlist.findMany({
      where: { userId },
      include: {
        _count: {
          select: { songs: true },
        },
        songs: {
          take: 4,
          include: {
            song: {
              select: {
                id: true,
                coverUrl: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add coverUrl from first 4 songs (composite cover)
    const playlistsWithCover = playlists.map((pl) => {
      const firstSong = pl.songs[0]?.song;
      return {
        id: pl.id,
        name: pl.name,
        description: pl.description,
        userId: pl.userId,
        songIds: pl.songIds,
        isDefault: pl.isDefault,
        canDelete: pl.canDelete,
        coverUrl: firstSong ? resolveCoverUrl({ id: firstSong.id, coverUrl: firstSong.coverUrl }) : null,
        createdAt: pl.createdAt,
        updatedAt: pl.updatedAt,
        _count: pl._count,
      };
    });

    return c.json({
      success: true,
      data: playlistsWithCover,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch playlists');
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
app.get('/:id', async (c: Context) => {
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    const playlist = await prisma.playlist.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { songs: true },
        },
      },
    });

    if (!playlist) {
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Invalid playlist ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to fetch playlist');
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
app.post('/', async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createPlaylistSchema.parse(body);
    const userId = getUserId(c);

    const playlist = await prisma.playlist.create({
      data: {
        ...data,
        userId,
      },
      include: {
        _count: {
          select: { songs: true },
        },
      },
    });

    return c.json(
      {
        success: true,
        data: playlist,
        message: 'Playlist created successfully',
      },
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to create playlist');
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
app.patch('/:id', async (c: Context) => {
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const data = updatePlaylistSchema.parse(body);
    const userId = getUserId(c);

    // Check if playlist exists and belongs to user
    const existingPlaylist = await prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!existingPlaylist) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    const playlist = await prisma.playlist.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { songs: true },
        },
      },
    });

    return c.json({
      success: true,
      data: playlist,
      message: 'Playlist updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to update playlist');
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
app.delete('/:id', async (c: Context) => {
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    // Check if playlist exists and belongs to user
    const existingPlaylist = await prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!existingPlaylist) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Check if playlist can be deleted (protection for default playlist)
    if (!existingPlaylist.canDelete) {
      return c.json(
        {
          success: false,
          message: '默认播放列表不能删除',
          error: 'CANNOT_DELETE_DEFAULT_PLAYLIST',
        },
        403
      );
    }

    await prisma.playlist.delete({
      where: { id },
    });

    return c.json({
      success: true,
      message: 'Playlist deleted successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Invalid playlist ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to delete playlist');
    return c.json(
      {
        success: false,
        error: 'Failed to delete playlist',
      },
      500
    );
  }
});

// GET /api/playlists/:id/songs - Get songs in playlist
app.get('/:id/songs', async (c: Context) => {
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    // Check if playlist exists and belongs to user
    const playlist = await prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!playlist) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Fetch songs based on songIds array order
    if (playlist.songIds.length === 0) {
      return c.json({
        success: true,
        data: [],
      });
    }

    const songs = await prisma.song.findMany({
      where: {
        id: { in: playlist.songIds },
      },
      include: {
        file: true,
        library: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create a map for quick lookup
    const songMap = new Map(songs.map((s) => [s.id, s]));

    // Return songs in the order specified by songIds
    const orderedSongs = playlist.songIds
      .map((songId) => songMap.get(songId))
      .filter((song) => song !== undefined)
      .map((song) => ({
        ...song,
        libraryName: song.library.name,
      }));

    return c.json({
      success: true,
      data: orderedSongs,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Invalid playlist ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to fetch playlist songs');
    return c.json(
      {
        success: false,
        error: 'Failed to fetch playlist songs',
      },
      500
    );
  }
});

// POST /api/playlists/:id/songs - Add song to playlist
app.post('/:id/songs', async (c: Context) => {
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const { songId } = addSongToPlaylistSchema.parse(body);
    const userId = getUserId(c);

    // Check if playlist exists and belongs to user
    const playlist = await prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!playlist) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Check if song exists and belongs to user's library
    const song = await prisma.song.findFirst({
      where: {
        id: songId,
        library: {
          userId,
        },
      },
    });

    if (!song) {
      return c.json(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }

    // Check if song is already in playlist
    if (playlist.songIds.includes(songId)) {
      return c.json(
        {
          success: false,
          error: 'Song is already in playlist',
        },
        400
      );
    }

    // Add song to playlist (append to songIds array)
    const updatedPlaylist = await prisma.playlist.update({
      where: { id },
      data: {
        songIds: {
          push: songId,
        },
      },
      include: {
        _count: {
          select: { songs: true },
        },
      },
    });

    return c.json(
      {
        success: true,
        message: 'Song added to playlist',
        data: {
          playlistId: id,
          songId,
          newSongCount: updatedPlaylist.songIds.length,
        },
      },
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to add song to playlist');
    return c.json(
      {
        success: false,
        error: 'Failed to add song to playlist',
      },
      500
    );
  }
});

// DELETE /api/playlists/:id/songs/:songId - Remove song from playlist
app.delete('/:id/songs/:songId', async (c: Context) => {
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const { songId } = removeSongFromPlaylistSchema.parse({
      songId: c.req.param('songId'),
    });
    const userId = getUserId(c);

    // Check if playlist exists and belongs to user
    const playlist = await prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!playlist) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Check if song is in playlist
    if (!playlist.songIds.includes(songId)) {
      return c.json(
        {
          success: false,
          error: 'Song not found in playlist',
        },
        404
      );
    }

    // Remove song from playlist (filter out from songIds array)
    const updatedSongIds = playlist.songIds.filter((id) => id !== songId);

    const updatedPlaylist = await prisma.playlist.update({
      where: { id },
      data: {
        songIds: updatedSongIds,
      },
    });

    return c.json({
      success: true,
      message: 'Song removed from playlist',
      data: {
        playlistId: id,
        songId,
        newSongCount: updatedPlaylist.songIds.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to remove song from playlist');
    return c.json(
      {
        success: false,
        error: 'Failed to remove song from playlist',
      },
      500
    );
  }
});

// PUT /api/playlists/:id/songs/reorder - Reorder songs in playlist
app.put('/:id/songs/reorder', async (c: Context) => {
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const { songIds } = z.object({ songIds: z.array(z.string()) }).parse(body);
    const userId = getUserId(c);

    // Check if playlist exists and belongs to user
    const playlist = await prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!playlist) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Validate that all songIds exist and belong to user's libraries
    const songs = await prisma.song.findMany({
      where: {
        id: { in: songIds },
        library: {
          userId,
        },
      },
    });

    if (songs.length !== songIds.length) {
      return c.json(
        {
          success: false,
          message: '歌曲顺序无效',
          error: 'INVALID_SONG_ORDER',
        },
        400
      );
    }

    // Update playlist with new order
    const updatedPlaylist = await prisma.playlist.update({
      where: { id },
      data: {
        songIds,
      },
    });

    logger.debug(
      {
        playlistId: id,
        songCount: songIds.length,
      },
      'Playlist songs reordered'
    );

    return c.json({
      success: true,
      message: 'Songs reordered successfully',
      data: {
        playlistId: id,
        songCount: updatedPlaylist.songIds.length,
        updatedAt: updatedPlaylist.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to reorder songs in playlist');
    return c.json(
      {
        success: false,
        error: 'Failed to reorder songs in playlist',
      },
      500
    );
  }
});

// GET /api/playlists/by-library/:libraryId - Get playlist linked to library
app.get('/by-library/:libraryId', async (c: Context) => {
  try {
    const userId = getUserId(c);
    const { libraryId } = c.req.param();

    const playlist = await prisma.playlist.findFirst({
      where: {
        userId,
        linkedLibraryId: libraryId,
      },
    });

    if (!playlist) {
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
  } catch (error) {
    logger.error({ error }, 'Failed to fetch library playlist');
    return c.json(
      {
        success: false,
        error: 'Failed to fetch library playlist',
      },
      500
    );
  }
});

// POST /api/playlists/for-library - Create playlist linked to library
app.post('/for-library', async (c: Context) => {
  try {
    const userId = getUserId(c);
    const body = await c.req.json();
    const { name, linkedLibraryId, songIds } = body;

    // Validate library belongs to user
    const library = await prisma.library.findFirst({
      where: { id: linkedLibraryId, userId },
    });

    if (!library) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    // Create playlist
    const playlist = await prisma.playlist.create({
      data: {
        name,
        userId,
        linkedLibraryId,
        songIds,
        canDelete: false, // Library playlists cannot be manually deleted
      },
    });

    // Create PlaylistSong entries
    const playlistSongData = songIds.map((songId: string, index: number) => ({
      playlistId: playlist.id,
      songId,
      order: index,
    }));

    await prisma.playlistSong.createMany({
      data: playlistSongData,
    });

    logger.info({ playlistId: playlist.id, linkedLibraryId }, 'Created library playlist');

    return c.json({
      success: true,
      data: playlist,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create library playlist');
    return c.json(
      {
        success: false,
        error: 'Failed to create library playlist',
      },
      500
    );
  }
});

// PUT /api/playlists/:id/songs - Update playlist songs (batch)
app.put('/:id/songs', async (c: Context) => {
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);
    const body = await c.req.json();
    const { songIds } = body;

    // Find playlist
    const playlist = await prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!playlist) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Delete existing PlaylistSong entries
    await prisma.playlistSong.deleteMany({
      where: { playlistId: id },
    });

    // Create new PlaylistSong entries
    const playlistSongData = songIds.map((songId: string, index: number) => ({
      playlistId: id,
      songId,
      order: index,
    }));

    await prisma.playlistSong.createMany({
      data: playlistSongData,
    });

    // Update songIds array
    await prisma.playlist.update({
      where: { id },
      data: { songIds },
    });

    logger.info({ playlistId: id, songCount: songIds.length }, 'Updated playlist songs');

    return c.json({
      success: true,
      data: null,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update playlist songs');
    return c.json(
      {
        success: false,
        error: 'Failed to update playlist songs',
      },
      500
    );
  }
});

export default app;
