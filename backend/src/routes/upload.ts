/**
 * Upload Routes (Hono Backend)
 * Admin routes - online only
 */

import { Hono } from 'hono';
import crypto from 'crypto';
import { parseBuffer } from 'music-metadata';
import type { Context } from 'hono';
import { prisma } from '../lib/prisma';
import { getMinioClient } from '../lib/minio-client';
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { getUserId } from '../lib/auth-helper';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// POST /api/upload - Upload audio file to MinIO
app.post('/', async (c: Context) => {
  try {
    const userId = getUserId(c);
    const formData = await c.req.formData();
    
    // 1. Extract file and metadata from form data
    const file = formData.get('file') as File;
    const frontendHash = formData.get('hash') as string;
    const libraryId = formData.get('libraryId') as string;
    
    if (!file) {
      return c.json(
        {
          success: false,
          error: 'No file provided',
        },
        400
      );
    }

    if (!libraryId) {
      return c.json(
        {
          success: false,
          error: 'Library ID is required',
        },
        400
      );
    }

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

    // 2. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Calculate and verify hash
    const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    if (frontendHash && frontendHash !== actualHash) {
      logger.warn({ frontendHash, actualHash }, 'Hash mismatch');
      return c.json(
        {
          success: false,
          error: 'File integrity check failed',
        },
        400
      );
    }

    const fileHash = actualHash;
    logger.info({ fileHash, fileName: file.name, fileSize: file.size }, 'Processing upload');

    // 4. Check if file already exists (deduplication)
    let fileRecord = await prisma.file.findUnique({
      where: { hash: fileHash },
    });

    let isNewFile = false;

    if (!fileRecord) {
      isNewFile = true;

      // 5. Extract metadata using music-metadata
      let metadata: {
        duration?: number;
        bitrate?: number;
        sampleRate?: number;
        channels?: number;
      } = {};

      try {
        const parsed = await parseBuffer(buffer, { mimeType: file.type });
        metadata = {
          duration: parsed.format.duration ? Math.floor(parsed.format.duration) : undefined,
          bitrate: parsed.format.bitrate ? Math.floor(parsed.format.bitrate / 1000) : undefined,
          sampleRate: parsed.format.sampleRate,
          channels: parsed.format.numberOfChannels,
        };
        logger.info(metadata, 'Metadata extracted');
      } catch (error) {
        logger.warn({ error }, 'Failed to extract metadata');
      }

      // 6. Upload to MinIO
      const minioClient = getMinioClient();
      const bucketName = process.env.MINIO_BUCKET_NAME || 'm3w-music';
      const objectName = `files/${fileHash}${getFileExtension(file.name)}`;

      // Ensure bucket exists
      const bucketExists = await minioClient.bucketExists(bucketName);
      if (!bucketExists) {
        await minioClient.makeBucket(bucketName);
        logger.info({ bucketName }, 'Created bucket');
      }

      // Upload file
      await minioClient.putObject(
        bucketName,
        objectName,
        buffer,
        buffer.length,
        {
          'Content-Type': file.type,
        }
      );

      logger.info({ objectName }, 'File uploaded to MinIO');

      // 7. Create File record
      fileRecord = await prisma.file.create({
        data: {
          hash: fileHash,
          path: objectName,
          size: file.size,
          mimeType: file.type,
          duration: metadata.duration,
          bitrate: metadata.bitrate,
          sampleRate: metadata.sampleRate,
          channels: metadata.channels,
          refCount: 0,
        },
      });

      logger.info({ fileId: fileRecord.id }, 'File record created');
    } else {
      logger.info({ fileId: fileRecord.id }, 'File already exists, reusing');
    }

    // 8. Extract user-provided metadata
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
      title: (formData.get('title') as string) || file.name.replace(/\.[^.]+$/, ''),
    };

    if (formData.get('artist')) userMetadata.artist = formData.get('artist') as string;
    if (formData.get('album')) userMetadata.album = formData.get('album') as string;
    if (formData.get('albumArtist')) userMetadata.albumArtist = formData.get('albumArtist') as string;
    if (formData.get('genre')) userMetadata.genre = formData.get('genre') as string;
    if (formData.get('composer')) userMetadata.composer = formData.get('composer') as string;
    if (formData.get('coverUrl')) userMetadata.coverUrl = formData.get('coverUrl') as string;
    if (formData.get('year')) userMetadata.year = parseInt(formData.get('year') as string, 10);
    if (formData.get('trackNumber')) userMetadata.trackNumber = parseInt(formData.get('trackNumber') as string, 10);
    if (formData.get('discNumber')) userMetadata.discNumber = parseInt(formData.get('discNumber') as string, 10);

    // 9. Create Song record and increment refCount
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

      return newSong;
    });

    logger.info({ songId: song.id, fileId: fileRecord.id }, 'Song created');

    return c.json({
      success: true,
      data: {
        song,
        file: fileRecord,
        isNewFile,
      },
    });
  } catch (error) {
    logger.error(error, 'Upload failed');
    logger.error(`Error details: ${error instanceof Error ? error.stack : String(error)}`);
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

/**
 * Helper function to extract file extension
 */
function getFileExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : '';
}

export default app;
