/**
 * Songs Routes (Hono Backend)
 * User data routes - offline capable
 */

import { Hono } from 'hono';
import { z } from 'zod';
import pinyin from 'pinyin';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { getUserId } from '../lib/auth-helper';
import { updateSongSchema, songIdSchema } from '@m3w/shared';
import { resolveCoverUrl } from '../lib/cover-url-helper';
import type { Context } from 'hono';
import type { SongSortOption } from '@m3w/shared';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper function: Convert text to Pinyin for sorting
 * Used for Chinese character support in alphabetical sorting
 */
function getPinyinSort(text: string): string {
  // Convert Chinese characters to Pinyin, flatten array, and join
  const pinyinArray = pinyin(text, { style: pinyin.STYLE_NORMAL });
  return pinyinArray.flat().join('').toLowerCase();
}

/**
 * Helper function: Sort songs by given option
 * Supports date, title, artist, and album sorting with Pinyin support for Chinese
 */
function sortSongs<T extends { title: string; artist: string | null; album: string | null; createdAt: Date }>(
  songs: T[],
  sortOption: SongSortOption
): T[] {
  const sorted = [...songs];

  switch (sortOption) {
    case 'title-asc':
      return sorted.sort((a, b) => {
        const aTitle = getPinyinSort(a.title);
        const bTitle = getPinyinSort(b.title);
        return aTitle.localeCompare(bTitle);
      });

    case 'title-desc':
      return sorted.sort((a, b) => {
        const aTitle = getPinyinSort(a.title);
        const bTitle = getPinyinSort(b.title);
        return bTitle.localeCompare(aTitle);
      });

    case 'artist-asc':
      return sorted.sort((a, b) => {
        const aArtist = getPinyinSort(a.artist || '');
        const bArtist = getPinyinSort(b.artist || '');
        return aArtist.localeCompare(bArtist);
      });

    case 'album-asc':
      return sorted.sort((a, b) => {
        const aAlbum = getPinyinSort(a.album || '');
        const bAlbum = getPinyinSort(b.album || '');
        return aAlbum.localeCompare(bAlbum);
      });

    case 'date-asc':
      return sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    case 'date-desc':
    default:
      return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

// GET /api/songs/search - Search songs across all or specific library
app.get('/search', async (c: Context) => {
  try {
    const userId = getUserId(c);
    const q = c.req.query('q') || '';
    const libraryId = c.req.query('libraryId');
    const sort = (c.req.query('sort') as SongSortOption) || 'date-desc';

    // Build where clause
    const whereClause = {
      library: {
        userId,
        ...(libraryId ? { id: libraryId } : {}),
      },
      OR: q
        ? [
            { title: { contains: q, mode: 'insensitive' as const } },
            { artist: { contains: q, mode: 'insensitive' as const } },
            { album: { contains: q, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    // Fetch songs with library info
    const songs = await prisma.song.findMany({
      where: whereClause,
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

    // Apply sorting
    const sortedSongs = sortSongs(songs, sort);

    // Transform to include libraryName
    const transformedSongs = sortedSongs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.file.duration,
      coverUrl: resolveCoverUrl({ id: song.id, coverUrl: song.coverUrl }),
      streamUrl: `/api/songs/${song.id}/stream`,
      libraryId: song.libraryId,
      libraryName: song.library?.name || '',
      createdAt: song.createdAt,
    }));

    logger.debug(
      {
        userId,
        query: q,
        libraryId,
        sort,
        resultCount: transformedSongs.length,
      },
      'Songs search completed'
    );

    return c.json({
      success: true,
      data: transformedSongs,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to search songs');
    return c.json(
      {
        success: false,
        error: 'Failed to search songs',
      },
      500
    );
  }
});

// GET /api/songs/:id - Get song by ID
app.get('/:id', async (c: Context) => {
  try {
    const { id } = songIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    const song = await prisma.song.findFirst({
      where: {
        id,
        library: {
          userId,
        },
      },
      include: {
        file: true,
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

    return c.json({
      success: true,
      data: {
        ...song,
        coverUrl: resolveCoverUrl({ id: song.id, coverUrl: song.coverUrl }),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Invalid song ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to fetch song');
    return c.json(
      {
        success: false,
        error: 'Failed to fetch song',
      },
      500
    );
  }
});

// PATCH /api/songs/:id - Update song metadata
app.patch('/:id', async (c: Context) => {
  try {
    const { id } = songIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const data = updateSongSchema.parse(body);
    const userId = getUserId(c);

    // Verify ownership through library
    const existing = await prisma.song.findFirst({
      where: {
        id,
        library: {
          userId,
        },
      },
    });

    if (!existing) {
      return c.json(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }

    const song = await prisma.song.update({
      where: { id },
      data,
    });

    return c.json({
      success: true,
      data: song,
      message: 'Song updated successfully',
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

    logger.error({ error }, 'Failed to update song');
    return c.json(
      {
        success: false,
        error: 'Failed to update song',
      },
      500
    );
  }
});

// GET /api/songs/:id/stream - Stream audio file (admin route - online only)
// Supports Range requests for seeking
// Accepts token as query parameter for Howler.js compatibility
app.get('/:id/stream', async (c: Context) => {
  try {
    // Get auth from middleware
    const auth = c.get('auth');

    const songId = c.req.param('id');

    // Get song and verify ownership through library
    const song = await prisma.song.findFirst({
      where: {
        id: songId,
        library: {
          userId: auth.userId,
        },
      },
      include: {
        file: true,
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

    // Import MinIO client dynamically
    const { getMinioClient } = await import('../lib/minio-client');
    const minioClient = getMinioClient();
    const bucketName = process.env.MINIO_BUCKET_NAME || 'm3w-music';

    // Get file stat to determine total size
    const stat = await minioClient.statObject(bucketName, song.file.path);
    const fileSize = stat.size;

    // Parse Range header for partial content requests
    const rangeHeader = c.req.header('range');
    let start = 0;
    let end = fileSize - 1;
    let statusCode = 200;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : end;
      statusCode = 206; // Partial Content

      logger.debug(
        {
          songId,
          start,
          end,
          fileSize,
        },
        'Range request'
      );
    }

    // Get object stream from MinIO
    const dataStream = await minioClient.getObject(bucketName, song.file.path);

    // For Range requests, we need to skip bytes and limit the stream
    let currentByte = 0;
    let isClosed = false;
    
    const closeController = (controller: ReadableStreamDefaultController, error?: Error) => {
      if (isClosed) return;
      isClosed = true;
      
      try {
        if (error) {
          controller.error(error);
        } else {
          controller.close();
        }
      } catch (err) {
        // Controller may already be closed, ignore the error
        logger.debug({ err }, 'Controller already closed');
      }
    };
    
    const transformedStream = new ReadableStream({
      async start(controller) {
        dataStream.on('data', (chunk: Buffer) => {
          if (isClosed) return;

          const chunkStart = currentByte;
          const chunkEnd = chunkStart + chunk.length;
          currentByte = chunkEnd;

          // Skip bytes before range start
          if (chunkEnd <= start) {
            return;
          }

          // Stop if we've passed range end
          if (chunkStart > end) {
            dataStream.destroy();
            closeController(controller);
            return;
          }

          // Trim chunk to fit range
          let output = chunk;
          if (chunkStart < start) {
            output = chunk.subarray(start - chunkStart);
          }
          if (chunkEnd > end + 1) {
            output = output.subarray(0, end + 1 - Math.max(chunkStart, start));
          }

          // Safely enqueue data
          try {
            if (!isClosed) {
              controller.enqueue(output);
            }
          } catch (err) {
            logger.error({ err }, 'Error enqueueing chunk');
            dataStream.destroy();
            closeController(controller);
            return;
          }

          // Close after range end
          if (chunkEnd >= end + 1) {
            dataStream.destroy();
            closeController(controller);
          }
        });

        dataStream.on('end', () => {
          closeController(controller);
        });

        dataStream.on('error', (error: Error) => {
          logger.error({ error }, 'MinIO stream error');
          closeController(controller, error);
        });
      },
      
      cancel() {
        // Clean up when stream is cancelled by client
        if (!isClosed) {
          dataStream.destroy();
          isClosed = true;
        }
      },
    });

    // Prepare response headers
    const headers: Record<string, string> = {
      'Content-Type': song.file.mimeType || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };

    if (statusCode === 206) {
      headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
      headers['Content-Length'] = String(end - start + 1);
    } else {
      headers['Content-Length'] = String(fileSize);
    }

    logger.info(
      {
        songId,
        userId: auth.userId,
        fileId: song.fileId,
        fileSize,
        range: rangeHeader || 'full',
      },
      'Audio stream started'
    );

    return new Response(transformedStream, {
      status: statusCode,
      headers,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to stream audio');
    return c.json(
      {
        success: false,
        error: 'Failed to stream audio',
      },
      500
    );
  }
});

// GET /api/songs/:id/playlist-count - Get number of playlists using this song
app.get('/:id/playlist-count', async (c: Context) => {
  try {
    const { id } = songIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    // Check if song belongs to user's library
    const song = await prisma.song.findFirst({
      where: {
        id,
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

    // Count playlists that contain this song
    const count = await prisma.playlistSong.count({
      where: {
        songId: id,
        playlist: {
          userId,
        },
      },
    });

    return c.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error({ error, songId: c.req.param('id') }, 'Failed to get playlist count');
    return c.json(
      {
        success: false,
        error: 'Failed to get playlist count',
      },
      500
    );
  }
});

// DELETE /api/songs/:id - Delete song from library
app.delete('/:id', async (c: Context) => {
  try {
    const { id } = songIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);
    const libraryId = c.req.query('libraryId'); // Get libraryId from query param

    if (!libraryId) {
      return c.json(
        {
          success: false,
          error: 'libraryId is required',
        },
        400
      );
    }

    // Check if song belongs to user's library AND the specified library
    const song = await prisma.song.findFirst({
      where: {
        id,
        libraryId, // Must match the specified library
        library: {
          userId,
        },
      },
      include: {
        file: true,
      },
    });

    if (!song) {
      return c.json(
        {
          success: false,
          error: 'Song not found in this library',
        },
        404
      );
    }

    const fileId = song.fileId;

    // Delete the song (cascade will handle playlist_songs)
    await prisma.song.delete({
      where: { id },
    });

    // Decrement file reference count
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (file) {
      const newRefCount = file.refCount - 1;
      
      if (newRefCount <= 0) {
        // Delete file record and physical file from MinIO
        await prisma.file.delete({
          where: { id: fileId },
        });
        
        // TODO: Delete physical file from MinIO
        // This would require MinIO client integration
        logger.info({ fileId, hash: file.hash }, 'File marked for deletion (refCount=0)');
      } else {
        // Just decrement the ref count
        await prisma.file.update({
          where: { id: fileId },
          data: { refCount: newRefCount },
        });
      }
    }

    logger.info({ songId: id, libraryId, userId }, 'Song deleted from library');

    return c.json({
      success: true,
      message: 'Song deleted successfully',
    });
  } catch (error) {
    logger.error({ error, songId: c.req.param('id') }, 'Failed to delete song');
    return c.json(
      {
        success: false,
        error: 'Failed to delete song',
      },
      500
    );
  }
});

// GET /api/songs/:id/cover - Get song cover image
// Returns cover image from MinIO or 404 if not available
app.get('/:id/cover', async (c: Context) => {
  try {
    const auth = c.get('auth');
    const songId = c.req.param('id');

    // Get song and verify ownership
    const song = await prisma.song.findFirst({
      where: {
        id: songId,
        library: {
          userId: auth.userId,
        },
      },
    });

    if (!song || !song.coverUrl) {
      return c.json(
        {
          success: false,
          error: 'Cover image not found',
        },
        404
      );
    }

    // If coverUrl is an external URL, redirect to it
    if (song.coverUrl.startsWith('http://') || song.coverUrl.startsWith('https://')) {
      return c.redirect(song.coverUrl);
    }

    // Otherwise, it's a MinIO path - fetch from storage
    const { getMinioClient } = await import('../lib/minio-client');
    const minioClient = getMinioClient();
    const bucketName = process.env.MINIO_BUCKET_NAME || 'm3w-music';

    try {
      // Get cover image from MinIO
      const dataStream = await minioClient.getObject(bucketName, song.coverUrl);
      
      // Determine content type from file extension
      const ext = song.coverUrl.split('.').pop()?.toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

      // Stream the image back to client
      const readableStream = new ReadableStream({
        async start(controller) {
          dataStream.on('data', (chunk: Buffer) => {
            controller.enqueue(chunk);
          });
          dataStream.on('end', () => {
            controller.close();
          });
          dataStream.on('error', (err) => {
            logger.error({ error: err, songId }, 'Error streaming cover image');
            controller.error(err);
          });
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        },
      });
    } catch (error) {
      logger.error({ error, songId, coverPath: song.coverUrl }, 'Failed to fetch cover from MinIO');
      return c.json(
        {
          success: false,
          error: 'Failed to fetch cover image',
        },
        500
      );
    }
  } catch (error) {
    logger.error({ error }, 'Failed to process cover request');
    return c.json(
      {
        success: false,
        error: 'Failed to process cover request',
      },
      500
    );
  }
});

export default app;
