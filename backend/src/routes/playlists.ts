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
  toPlaylistResponse,
  toSongListResponse,
} from '@m3w/shared';
import type { Context } from 'hono';
import type { ApiResponse, Playlist, Song, PlaylistInput, SongInput, PlaylistSongOperationResult, PlaylistReorderResult } from '@m3w/shared';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper: Get cover URL from first song in playlist
 */
async function getPlaylistCoverUrl(playlistId: string): Promise<string | null> {
  const firstSong = await prisma.playlistSong.findFirst({
    where: { playlistId },
    orderBy: { order: 'asc' },
    include: {
      song: {
        select: { id: true, coverUrl: true },
      },
    },
  });
  if (!firstSong?.song) return null;
  return resolveCoverUrl({ id: firstSong.song.id, coverUrl: firstSong.song.coverUrl });
}

// GET /api/playlists - List all playlists for current user
app.get('/', async (c: Context) => {
  try {
    const userId = getUserId(c);

    const playlists = await prisma.playlist.findMany({
      where: { userId },
      include: {
        songs: {
          take: 1,
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

    // Transform to API response format using shared transformer
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
        coverUrl: firstSong ? resolveCoverUrl({ id: firstSong.id, coverUrl: firstSong.coverUrl }) : null,
        createdAt: pl.createdAt,
        updatedAt: pl.updatedAt,
      };
      return toPlaylistResponse(input);
    });

    return c.json<ApiResponse<Playlist[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch playlists');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to fetch playlists',
      },
      500
    );
  }
});

// GET /api/playlists/by-library/:libraryId - Get playlist linked to library
// NOTE: Static routes must be defined BEFORE parameterized routes (/:id)
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
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Transform to API response format using shared transformer
    const input: PlaylistInput = {
      ...playlist,
      coverUrl: await getPlaylistCoverUrl(playlist.id),
    };

    return c.json<ApiResponse<Playlist>>({
      success: true,
      data: toPlaylistResponse(input),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch library playlist');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to fetch library playlist',
      },
      500
    );
  }
});

// POST /api/playlists/for-library - Create playlist linked to library
// NOTE: Static routes must be defined BEFORE parameterized routes (/:id)
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
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    const songCount = songIds?.length || 0;

    // Validate that all songs exist and belong to the linked library
    if (songIds && songIds.length > 0) {
      const validSongs = await prisma.song.findMany({
        where: {
          id: { in: songIds },
          libraryId: linkedLibraryId,
          library: { userId },
        },
        select: { id: true },
      });

      if (validSongs.length !== songIds.length) {
        return c.json<ApiResponse<never>>(
          {
            success: false,
            error: 'Invalid song IDs or songs do not belong to linked library',
          },
          400
        );
      }
    }

    // Create playlist with songCount
    const playlist = await prisma.playlist.create({
      data: {
        name,
        userId,
        linkedLibraryId,
        songCount,
        canDelete: false, // Library playlists cannot be manually deleted
      },
    });

    // Create PlaylistSong entries
    if (songIds && songIds.length > 0) {
      const playlistSongData = songIds.map((songId: string, index: number) => ({
        playlistId: playlist.id,
        songId,
        order: index,
      }));

      await prisma.playlistSong.createMany({
        data: playlistSongData,
      });
    }

    logger.info({ playlistId: playlist.id, linkedLibraryId, songCount }, 'Created library playlist');

    // Transform to API response format
    const input: PlaylistInput = {
      ...playlist,
      coverUrl: await getPlaylistCoverUrl(playlist.id),
    };

    return c.json<ApiResponse<Playlist>>({
      success: true,
      data: toPlaylistResponse(input),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create library playlist');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to create library playlist',
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
        songs: {
          take: 1,
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

    // Transform to API response format using shared transformer
    const firstSong = playlist.songs[0]?.song;
    const input: PlaylistInput = {
      ...playlist,
      coverUrl: firstSong ? resolveCoverUrl({ id: firstSong.id, coverUrl: firstSong.coverUrl }) : null,
    };

    return c.json<ApiResponse<Playlist>>({
      success: true,
      data: toPlaylistResponse(input),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Invalid playlist ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to fetch playlist');
    return c.json<ApiResponse<never>>(
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
        songCount: 0,
      },
    });

    // Transform to API response format
    const input: PlaylistInput = {
      ...playlist,
      coverUrl: null,  // New playlist has no songs yet
    };

    return c.json<ApiResponse<Playlist>>(
      {
        success: true,
        data: toPlaylistResponse(input),
      },
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to create playlist');
    return c.json<ApiResponse<never>>(
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
      return c.json<ApiResponse<never>>(
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
        songs: {
          take: 1,
          include: {
            song: {
              select: { id: true, coverUrl: true },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    // Transform to API response format
    const firstSong = playlist.songs[0]?.song;
    const input: PlaylistInput = {
      ...playlist,
      coverUrl: firstSong ? resolveCoverUrl({ id: firstSong.id, coverUrl: firstSong.coverUrl }) : null,
    };

    return c.json<ApiResponse<Playlist>>({
      success: true,
      data: toPlaylistResponse(input),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to update playlist');
    return c.json<ApiResponse<never>>(
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
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Check if playlist can be deleted (protection for default playlist)
    if (!existingPlaylist.canDelete) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Cannot delete default playlist',
        },
        403
      );
    }

    // PlaylistSong entries will be cascade deleted
    await prisma.playlist.delete({
      where: { id },
    });

    return c.json<ApiResponse<undefined>>({
      success: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Invalid playlist ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to delete playlist');
    return c.json<ApiResponse<never>>(
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
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Fetch songs via PlaylistSong junction table (ordered by order field)
    const playlistSongs = await prisma.playlistSong.findMany({
      where: { playlistId: id },
      orderBy: { order: 'asc' },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            artist: true,
            album: true,
            albumArtist: true,
            year: true,
            genre: true,
            trackNumber: true,
            discNumber: true,
            composer: true,
            coverUrl: true,
            fileId: true,
            libraryId: true,
            createdAt: true,
            updatedAt: true,
            file: {
              select: {
                duration: true,
                mimeType: true,
              },
            },
            library: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Transform to Song response format (already in correct order)
    const orderedSongInputs: SongInput[] = playlistSongs
      .map(ps => ps.song)
      .map((song) => ({
        ...song,
        coverUrl: resolveCoverUrl({ id: song.id, coverUrl: song.coverUrl }),
      }));

    // Transform to API response format using shared transformer
    return c.json<ApiResponse<Song[]>>({
      success: true,
      data: toSongListResponse(orderedSongInputs),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Invalid playlist ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to fetch playlist songs');
    return c.json<ApiResponse<never>>(
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
      return c.json<ApiResponse<never>>(
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
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }

    // Check if song is already in playlist
    const existingEntry = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: { playlistId: id, songId },
      },
    });

    if (existingEntry) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Song is already in playlist',
        },
        400
      );
    }

    // Use transaction to ensure atomicity and avoid race conditions
    await prisma.$transaction(async (tx) => {
      // Get current max order inside transaction for consistency
      const maxOrderEntry = await tx.playlistSong.findFirst({
        where: { playlistId: id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const newOrder = (maxOrderEntry?.order ?? -1) + 1;

      // Create PlaylistSong entry
      await tx.playlistSong.create({
        data: {
          playlistId: id,
          songId,
          order: newOrder,
        },
      });

      // Increment songCount
      await tx.playlist.update({
        where: { id },
        data: { songCount: { increment: 1 } },
      });
    });

    return c.json<ApiResponse<PlaylistSongOperationResult>>(
      {
        success: true,
        data: {
          playlistId: id,
          songId,
          newSongCount: playlist.songCount + 1,
        },
      },
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to add song to playlist');
    return c.json<ApiResponse<never>>(
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
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Check if song is in playlist
    const existingEntry = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: { playlistId: id, songId },
      },
    });

    if (!existingEntry) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Song not found in playlist',
        },
        404
      );
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction([
      // Delete the PlaylistSong entry
      prisma.playlistSong.delete({
        where: {
          playlistId_songId: { playlistId: id, songId },
        },
      }),
      // Decrement songCount
      prisma.playlist.update({
        where: { id },
        data: { songCount: { decrement: 1 } },
      }),
    ]);

    return c.json<ApiResponse<PlaylistSongOperationResult>>({
      success: true,
      data: {
        playlistId: id,
        songId,
        newSongCount: playlist.songCount - 1,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to remove song from playlist');
    return c.json<ApiResponse<never>>(
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
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Validate that all songIds exist in the playlist
    const existingEntries = await prisma.playlistSong.findMany({
      where: { playlistId: id },
      select: { songId: true },
    });
    const existingSongIds = new Set(existingEntries.map(e => e.songId));

    // Validate song count matches
    if (songIds.length !== existingEntries.length) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Song count mismatch - all songs must be included in reorder',
        },
        400
      );
    }

    for (const songId of songIds) {
      if (!existingSongIds.has(songId)) {
        return c.json<ApiResponse<never>>(
          {
            success: false,
            error: 'Invalid song order - song not in playlist',
          },
          400
        );
      }
    }

    // Batch update order using transaction
    await prisma.$transaction(
      songIds.map((songId, index) =>
        prisma.playlistSong.update({
          where: { playlistId_songId: { playlistId: id, songId } },
          data: { order: index },
        })
      )
    );

    // Update playlist timestamp
    const updatedPlaylist = await prisma.playlist.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    logger.debug(
      {
        playlistId: id,
        songCount: songIds.length,
      },
      'Playlist songs reordered'
    );

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
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to reorder songs in playlist');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to reorder songs in playlist',
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
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    const newSongCount = songIds?.length || 0;

    // Use transaction to replace all PlaylistSong entries
    await prisma.$transaction(async (tx) => {
      // Delete existing PlaylistSong entries
      await tx.playlistSong.deleteMany({
        where: { playlistId: id },
      });

      // Create new PlaylistSong entries
      if (songIds && songIds.length > 0) {
        const playlistSongData = songIds.map((songId: string, index: number) => ({
          playlistId: id,
          songId,
          order: index,
        }));

        await tx.playlistSong.createMany({
          data: playlistSongData,
        });
      }

      // Update playlist timestamp and songCount
      await tx.playlist.update({
        where: { id },
        data: { 
          updatedAt: new Date(),
          songCount: newSongCount,
        },
      });
    });

    logger.info({ playlistId: id, songCount: newSongCount }, 'Updated playlist songs');

    return c.json<ApiResponse<null>>({
      success: true,
      data: null,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update playlist songs');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to update playlist songs',
      },
      500
    );
  }
});

export default app;
