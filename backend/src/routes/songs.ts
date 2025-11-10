/**
 * Songs Routes (Hono Backend)
 * User data routes - offline capable
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { getUserId } from '../lib/auth-helper';
import { updateSongSchema, songIdSchema } from '@m3w/shared';
import type { Context } from 'hono';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

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
      data: song,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Invalid song ID',
          details: error.errors,
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
          details: error.errors,
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

// DELETE /api/songs/:id - Delete song
app.delete('/:id', async (c: Context) => {
  try {
    const { id } = songIdSchema.parse({ id: c.req.param('id') });
    const userId = getUserId(c);

    // Verify ownership
    const existing = await prisma.song.findFirst({
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

    if (!existing) {
      return c.json(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }

    // Delete song (cascade will remove from playlists)
    await prisma.song.delete({
      where: { id },
    });

    // Decrement file reference count
    if (existing.fileId) {
      await prisma.file.update({
        where: { id: existing.fileId },
        data: {
          refCount: {
            decrement: 1,
          },
        },
      });

      // TODO: Implement garbage collection for files with refCount === 0
      // Should be done in a background job, not inline
    }

    return c.json({
      success: true,
      message: 'Song deleted successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Invalid song ID',
          details: error.errors,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to delete song');
    return c.json(
      {
        success: false,
        error: 'Failed to delete song',
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
            if (!isClosed) {
              isClosed = true;
              controller.close();
            }
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

          controller.enqueue(output);

          // Close after range end
          if (chunkEnd >= end + 1) {
            dataStream.destroy();
            if (!isClosed) {
              isClosed = true;
              controller.close();
            }
          }
        });

        dataStream.on('end', () => {
          if (!isClosed) {
            isClosed = true;
            controller.close();
          }
        });

        dataStream.on('error', (error: Error) => {
          logger.error({ error }, 'MinIO stream error');
          if (!isClosed) {
            isClosed = true;
            controller.error(error);
          }
        });
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

export default app;
