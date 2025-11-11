import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { getUserId } from '../lib/auth-helper';
import {
  createPlaylistSchema,
  updatePlaylistSchema,
  playlistIdSchema,
  addSongToPlaylistSchema,
  removeSongFromPlaylistSchema,
  reorderPlaylistSongSchema,
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
      },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({
      success: true,
      data: playlists,
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
      include: {
        songs: {
          include: {
            song: {
              include: {
                file: true,
                library: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
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

    // Transform to flat song list with file metadata and library info
    const songs = playlist.songs.map((ps) => ({
      ...ps.song,
      mimeType: ps.song.file.mimeType,
      duration: ps.song.file.duration,
      library: ps.song.library, // Preserve library information
    }));

    return c.json({
      success: true,
      data: songs,
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
    const existingSong = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: {
          playlistId: id,
          songId,
        },
      },
    });

    if (existingSong) {
      return c.json(
        {
          success: false,
          error: 'Song is already in playlist',
        },
        400
      );
    }

    // Add song to playlist
    await prisma.playlistSong.create({
      data: {
        playlistId: id,
        songId,
      },
    });

    return c.json(
      {
        success: true,
        message: 'Song added to playlist',
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

    // Remove song from playlist
    const deleted = await prisma.playlistSong.deleteMany({
      where: {
        playlistId: id,
        songId,
      },
    });

    if (deleted.count === 0) {
      return c.json(
        {
          success: false,
          error: 'Song not found in playlist',
        },
        404
      );
    }

    return c.json({
      success: true,
      message: 'Song removed from playlist',
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

// POST /api/playlists/:id/songs/reorder - Reorder song in playlist
app.post('/:id/songs/reorder', async (c: Context) => {
  try {
    const { id } = playlistIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const { songId, direction } = reorderPlaylistSongSchema.parse(body);
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

    // Find current song in playlist
    const currentSong = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: {
          playlistId: id,
          songId,
        },
      },
    });

    if (!currentSong) {
      return c.json(
        {
          success: false,
          error: 'Song not found in playlist',
        },
        404
      );
    }

    // Find adjacent song to swap with
    const adjacentSong = await prisma.playlistSong.findFirst({
      where: {
        playlistId: id,
        order: direction === 'up' ? { lt: currentSong.order } : { gt: currentSong.order },
      },
      orderBy: {
        order: direction === 'up' ? 'desc' : 'asc',
      },
    });

    // If no adjacent song found, we're at the boundary - return success without changes
    if (!adjacentSong) {
      logger.debug(
        { playlistId: id, songId, direction, currentOrder: currentSong.order },
        'Song already at boundary, no reorder needed'
      );
      return c.json({
        success: true,
        message: 'Song is already at the boundary',
      });
    }

    // Swap orders using transaction
    await prisma.$transaction([
      prisma.playlistSong.update({
        where: {
          playlistId_songId: {
            playlistId: id,
            songId: currentSong.songId,
          },
        },
        data: { order: adjacentSong.order },
      }),
      prisma.playlistSong.update({
        where: {
          playlistId_songId: {
            playlistId: id,
            songId: adjacentSong.songId,
          },
        },
        data: { order: currentSong.order },
      }),
    ]);

    logger.debug(
      {
        playlistId: id,
        songId,
        direction,
        oldOrder: currentSong.order,
        newOrder: adjacentSong.order,
      },
      'Playlist song reordered'
    );

    return c.json({
      success: true,
      message: 'Song reordered successfully',
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

    logger.error({ error }, 'Failed to reorder song in playlist');
    return c.json(
      {
        success: false,
        error: 'Failed to reorder song in playlist',
      },
      500
    );
  }
});

export default app;
