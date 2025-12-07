/**
 * Upload Routes (Hono Backend)
 * Admin routes - online only
 *
 * Implements streaming upload with:
 * - Head buffering for metadata extraction (first 1MB)
 * - Direct streaming to MinIO (no full file buffering)
 * - SHA256 hash calculation during streaming
 *
 * @see https://github.com/test3207/m3w/issues/120
 */

import { Hono } from 'hono';
import type { HttpBindings } from '@hono/node-server';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { getUserId } from '../lib/auth-helper';
import { resolveCoverUrl } from '../lib/cover-url-helper';
import {
  parseStreamingUpload,
  uploadCoverImage,
} from '../lib/services/upload.service';

// Compile-time constant injected by tsup for tree-shaking
declare const __IS_DEMO_BUILD__: boolean;

const app = new Hono<{ Bindings: HttpBindings }>();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// POST /api/upload - Upload audio file to MinIO (streaming)
app.post('/', async (c) => {
  try {
    const userId = getUserId(c);
    const bucketName = process.env.MINIO_BUCKET_NAME || 'm3w-music';

    // Access Node.js IncomingMessage from Hono's env binding
    const nodeRequest = c.env.incoming;

    // Parse streaming upload using Node.js IncomingMessage
    const { fields, file } = await parseStreamingUpload(nodeRequest, bucketName);

    const { libraryId } = fields;

    // Verify library ownership
    const library = await prisma.library.findFirst({
      where: { id: libraryId, userId },
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

    logger.info(
      { fileHash: file.hash, fileName: file.originalFilename, fileSize: file.size },
      'Processing upload'
    );

    // Check if file already exists (deduplication)
    let fileRecord = await prisma.file.findUnique({
      where: { hash: file.hash },
    });

    let isNewFile = false;

    if (!fileRecord) {
      isNewFile = true;

      // Check storage limit before processing (Demo mode only)
      if (__IS_DEMO_BUILD__) {
        try {
          const { storageTracker } = await import('../lib/demo/storage-tracker');
          if (storageTracker.enabled && !storageTracker.canUpload(file.size)) {
            return c.json(
              {
                success: false,
                error: 'Storage limit reached (5GB). Please wait for next reset.',
              },
              403
            );
          }
        } catch {
          // Demo modules not available, continue normally
          logger.debug('Demo modules not available');
        }
      }

      // Create File record
      fileRecord = await prisma.file.create({
        data: {
          hash: file.hash,
          path: file.objectName,
          size: file.size,
          mimeType: file.mimeType,
          duration: file.metadata.duration,
          bitrate: file.metadata.bitrate,
          sampleRate: file.metadata.sampleRate,
          channels: file.metadata.channels,
          refCount: 0,
        },
      });

      logger.info({ fileId: fileRecord.id }, 'File record created');

      // Increment storage usage (Demo mode only)
      if (__IS_DEMO_BUILD__) {
        try {
          const { storageTracker } = await import('../lib/demo/storage-tracker');
          if (storageTracker.enabled) {
            storageTracker.incrementUsage(file.size);
          }
        } catch {
          // Demo modules not available, continue normally
          logger.debug('Demo modules not available for tracking');
        }
      }
    } else {
      logger.info({ fileId: fileRecord.id }, 'File already exists, reusing');
    }

    // Upload cover image to MinIO if extracted
    let coverUrl: string | null = null;
    if (isNewFile && file.coverImage) {
      try {
        coverUrl = await uploadCoverImage(file.coverImage, file.hash, bucketName);
      } catch (error) {
        logger.warn({ error }, 'Failed to upload cover image');
      }
    }

    // Build user metadata
    const userMetadata: {
      libraryId: string;
      title: string;
      artist?: string;
      album?: string;
      albumArtist?: string;
      genre?: string;
      composer?: string;
      coverUrl?: string;
      year?: number;
      trackNumber?: number;
      discNumber?: number;
    } = {
      libraryId,
      title: fields.title || file.originalFilename.replace(/\.[^.]+$/, ''),
    };

    if (fields.artist) userMetadata.artist = fields.artist;
    if (fields.album) userMetadata.album = fields.album;
    if (fields.albumArtist) userMetadata.albumArtist = fields.albumArtist;
    if (fields.genre) userMetadata.genre = fields.genre;
    if (fields.composer) userMetadata.composer = fields.composer;

    // Use extracted cover if available, otherwise user-provided URL
    if (coverUrl) {
      userMetadata.coverUrl = coverUrl;
    } else if (fields.coverUrl) {
      userMetadata.coverUrl = fields.coverUrl;
    }

    if (fields.year) userMetadata.year = parseInt(fields.year, 10);
    if (fields.trackNumber)
      userMetadata.trackNumber = parseInt(fields.trackNumber, 10);
    if (fields.discNumber)
      userMetadata.discNumber = parseInt(fields.discNumber, 10);

    // Check if song already exists in this library
    const existingSong = await prisma.song.findFirst({
      where: {
        libraryId,
        fileId: fileRecord!.id,
      },
      include: {
        file: true,
      },
    });

    if (existingSong) {
      logger.info(
        { songId: existingSong.id, libraryId },
        'Song already exists in this library'
      );
      return c.json(
        {
          success: false,
          error: 'This song already exists in the selected library',
          details: `"${existingSong.title}" is already in this library`,
        },
        409 // Conflict
      );
    }

    // Create Song record, increment refCount and library songCount
    const song = await prisma.$transaction(async (tx) => {
      // Create song
      const newSong = await tx.song.create({
        data: {
          ...userMetadata,
          fileId: fileRecord!.id,
        },
        include: {
          file: true,
        },
      });

      // Increment file refCount
      await tx.file.update({
        where: { id: fileRecord!.id },
        data: { refCount: { increment: 1 } },
      });

      // Increment library songCount
      await tx.library.update({
        where: { id: libraryId },
        data: { songCount: { increment: 1 } },
      });

      return newSong;
    });

    logger.info({ songId: song.id, fileId: fileRecord.id }, 'Song created');

    return c.json({
      success: true,
      data: {
        song: {
          ...song,
          coverUrl: resolveCoverUrl({ id: song.id, coverUrl: song.coverUrl }),
        },
        file: fileRecord,
        isNewFile,
      },
    });
  } catch (error) {
    logger.error(error, 'Upload failed');
    logger.error(
      `Error details: ${error instanceof Error ? error.stack : String(error)}`
    );
    return c.json(
      {
        success: false,
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default app;
