/**
 * Songs Routes (Hono Backend)
 * User data routes - offline capable
 * 
 * @related When modifying routes, sync these files:
 * - shared/src/api-contracts.ts - Route definitions and offline capability
 * - frontend/src/lib/offline-proxy/routes/songs.ts - Offline proxy handlers
 * - frontend/src/services/api/main/endpoints.ts - Frontend endpoint definitions
 * - frontend/src/services/api/main/resources/songs.ts - Frontend API methods
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { getUserId } from '../lib/auth-helper';
import { updateSongSchema, songIdSchema, toSongResponse, toSongListResponse } from '@m3w/shared';
import type { Context } from 'hono';
import type { ApiResponse, Song, SongSortOption, SongInput, SongPlaylistCount } from '@m3w/shared';
import {
  sortSongs,
  searchSongs,
  findSongById,
  findSongForStreaming,
  updateSong,
  verifySongInLibrary,
  countPlaylistsWithSong,
  getPlaylistsContainingSong,
  deleteSong,
  cleanupFileAfterSongDeletion,
} from '../services/song.service';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// GET /api/songs/search - Search songs across all or specific library
app.get('/search', async (c: Context) => {
  const log = createLogger(c);
  try {
    const userId = getUserId(c);
    const q = c.req.query('q') || '';
    const libraryId = c.req.query('libraryId');
    const sort = (c.req.query('sort') as SongSortOption) || 'date-desc';

    const songs = await searchSongs(userId, q, libraryId || undefined);
    const sortedSongs = sortSongs(songs, sort);

    const songInputs: SongInput[] = sortedSongs.map((song) => ({
      ...song,
    }));

    const transformedSongs = toSongListResponse(songInputs);

    log.debug({
      source: 'songs.search',
      col1: 'song',
      col2: 'search',
      raw: { query: q, libraryId, sort, resultCount: transformedSongs.length },
      message: 'Songs search completed',
    });

    return c.json<ApiResponse<Song[]>>({ success: true, data: transformedSongs });
  } catch (error) {
    log.error({
      source: 'songs.search',
      col1: 'song',
      col2: 'search',
      message: 'Failed to search songs',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to search songs' }, 500);
  }
});

// GET /api/songs/:id - Get song by ID
app.get('/:id', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = songIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    const song = await findSongById(id, userId);

    if (!song) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Song not found' }, 404);
    }

    const songInput: SongInput = {
      ...song,
    };

    return c.json<ApiResponse<Song>>({ success: true, data: toSongResponse(songInput) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Invalid song ID', details: error.issues }, 400);
    }
    log.error({
      source: 'songs.get',
      col1: 'song',
      col2: 'get',
      col3: c.req.param('id'),
      message: 'Failed to fetch song',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to fetch song' }, 500);
  }
});

// PATCH /api/songs/:id - Update song metadata
app.patch('/:id', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = songIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const data = updateSongSchema.parse(body);
    const userId = getUserId(c);

    // Verify ownership through library
    const existing = await prisma.song.findFirst({
      where: { id, library: { userId } },
    });

    if (!existing) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Song not found' }, 404);
    }

    const song = await updateSong(id, {
      title: data.title,
      artist: data.artist ?? undefined,
      album: data.album ?? undefined,
      albumArtist: data.albumArtist ?? undefined,
      year: data.year ?? undefined,
      genre: data.genre ?? undefined,
      trackNumber: data.trackNumber ?? undefined,
      discNumber: data.discNumber ?? undefined,
      composer: data.composer ?? undefined,
    });

    const songInput: SongInput = {
      ...song,
    };

    return c.json<ApiResponse<Song>>({ success: true, data: toSongResponse(songInput) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Validation failed', details: error.issues }, 400);
    }
    log.error({
      source: 'songs.update',
      col1: 'song',
      col2: 'update',
      col3: c.req.param('id'),
      message: 'Failed to update song',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to update song' }, 500);
  }
});

// GET /api/songs/:id/stream - Stream audio file (admin route - online only)
// Supports Range requests for seeking
// Accepts token as query parameter for Howler.js compatibility
app.get('/:id/stream', async (c: Context) => {
  const log = createLogger(c);
  try {
    const auth = c.get('auth');
    const songId = c.req.param('id');

    const song = await findSongForStreaming(songId, auth.userId);

    if (!song) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Song not found' }, 404);
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
      statusCode = 206;
      log.debug({
        source: 'songs.stream',
        col1: 'song',
        col2: 'stream',
        col3: songId,
        raw: { start, end, fileSize },
        message: 'Range request',
      });
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
        log.debug({
          source: 'songs.stream',
          col1: 'song',
          col2: 'stream',
          col3: songId,
          raw: { err: err instanceof Error ? err.message : String(err) },
          message: 'Controller already closed',
        });
      }
    };
    
    const transformedStream = new ReadableStream({
      async start(controller) {
        dataStream.on('data', (chunk: Buffer) => {
          if (isClosed) return;

          const chunkStart = currentByte;
          const chunkEnd = chunkStart + chunk.length;
          currentByte = chunkEnd;

          if (chunkEnd <= start) return;
          if (chunkStart > end) {
            dataStream.destroy();
            closeController(controller);
            return;
          }

          let output = chunk;
          if (chunkStart < start) {
            output = chunk.subarray(start - chunkStart);
          }
          if (chunkEnd > end + 1) {
            output = output.subarray(0, end + 1 - Math.max(chunkStart, start));
          }

          try {
            if (!isClosed) controller.enqueue(output);
          } catch (err) {
            log.error({
              source: 'songs.stream',
              col1: 'song',
              col2: 'stream',
              col3: songId,
              message: 'Error enqueueing chunk',
              error: err,
            });
            dataStream.destroy();
            closeController(controller);
            return;
          }

          if (chunkEnd >= end + 1) {
            dataStream.destroy();
            closeController(controller);
          }
        });

        dataStream.on('end', () => closeController(controller));
        dataStream.on('error', (error: Error) => {
          log.error({
            source: 'songs.stream',
            col1: 'song',
            col2: 'stream',
            col3: songId,
            message: 'MinIO stream error',
            error,
          });
          closeController(controller, error);
        });
      },
      cancel() {
        if (!isClosed) {
          dataStream.destroy();
          isClosed = true;
        }
      },
    });

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

    log.info({
      source: 'songs.stream',
      col1: 'song',
      col2: 'stream',
      col3: songId,
      raw: { fileId: song.fileId, fileSize, range: rangeHeader || 'full' },
      message: 'Audio stream started',
    });

    return new Response(transformedStream, { status: statusCode, headers });
  } catch (error) {
    log.error({
      source: 'songs.stream',
      col1: 'song',
      col2: 'stream',
      col3: c.req.param('id'),
      message: 'Failed to stream audio',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to stream audio' }, 500);
  }
});

// GET /api/songs/:id/playlist-count - Get number of playlists using this song
app.get('/:id/playlist-count', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = songIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    const song = await prisma.song.findFirst({
      where: { id, library: { userId } },
    });

    if (!song) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Song not found' }, 404);
    }

    const count = await countPlaylistsWithSong(id, userId);

    return c.json<ApiResponse<SongPlaylistCount>>({ success: true, data: { count } });
  } catch (error) {
    log.error({
      source: 'songs.playlistCount',
      col1: 'song',
      col2: 'get',
      col3: c.req.param('id'),
      message: 'Failed to get playlist count',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to get playlist count' }, 500);
  }
});

// DELETE /api/songs/:id - Delete song from library
app.delete('/:id', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = songIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);
    const libraryId = c.req.query('libraryId');

    if (!libraryId) {
      return c.json<ApiResponse<never>>({ success: false, error: 'libraryId is required' }, 400);
    }

    const song = await verifySongInLibrary(id, libraryId, userId);

    if (!song) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Song not found in this library' }, 404);
    }

    const fileId = song.fileId;
    const affectedPlaylistIds = await getPlaylistsContainingSong(id);

    await deleteSong(id, libraryId, affectedPlaylistIds);

    if (affectedPlaylistIds.length > 0) {
      log.info({
        source: 'songs.delete',
        col1: 'song',
        col2: 'delete',
        col3: id,
        raw: { affectedPlaylistIds },
        message: 'Updated songCount for affected playlists',
      });
    }

    await cleanupFileAfterSongDeletion(fileId);

    log.info({
      source: 'songs.delete',
      col1: 'song',
      col2: 'delete',
      col3: id,
      raw: { libraryId },
      message: 'Song deleted from library',
    });

    return c.json<ApiResponse<undefined>>({ success: true });
  } catch (error) {
    log.error({
      source: 'songs.delete',
      col1: 'song',
      col2: 'delete',
      col3: c.req.param('id'),
      message: 'Failed to delete song',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to delete song' }, 500);
  }
});

// GET /api/songs/:id/cover - Get song cover image
app.get('/:id/cover', async (c: Context) => {
  const log = createLogger(c);
  try {
    const auth = c.get('auth');
    const songId = c.req.param('id');

    const song = await prisma.song.findFirst({
      where: { id: songId, library: { userId: auth.userId } },
    });

    if (!song || !song.coverUrl) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Cover image not found' }, 404);
    }

    // If coverUrl is an external URL, redirect to it
    if (song.coverUrl.startsWith('http://') || song.coverUrl.startsWith('https://')) {
      return c.redirect(song.coverUrl);
    }

    // Otherwise, fetch from MinIO
    const { getMinioClient } = await import('../lib/minio-client');
    const minioClient = getMinioClient();
    const bucketName = process.env.MINIO_BUCKET_NAME || 'm3w-music';

    try {
      const dataStream = await minioClient.getObject(bucketName, song.coverUrl);
      
      const ext = song.coverUrl.split('.').pop()?.toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

      const readableStream = new ReadableStream({
        async start(controller) {
          dataStream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
          dataStream.on('end', () => controller.close());
          dataStream.on('error', (err) => {
            log.error({
              source: 'songs.cover',
              col1: 'song',
              col2: 'cover',
              col3: songId,
              message: 'Error streaming cover image',
              error: err,
            });
            controller.error(err);
          });
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    } catch (error) {
      log.error({
        source: 'songs.cover',
        col1: 'song',
        col2: 'cover',
        col3: songId,
        raw: { coverPath: song.coverUrl },
        message: 'Failed to fetch cover from MinIO',
        error,
      });
      return c.json<ApiResponse<never>>({ success: false, error: 'Failed to fetch cover image' }, 500);
    }
  } catch (error) {
    log.error({
      source: 'songs.cover',
      col1: 'song',
      col2: 'cover',
      col3: c.req.param('id'),
      message: 'Failed to process cover request',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to process cover request' }, 500);
  }
});

export default app;
