/**
 * Libraries Routes (Hono Backend)
 * User data routes - offline capable
 * 
 * @related When modifying routes, sync these files:
 * - shared/src/api-contracts.ts - Route definitions and offline capability
 * - frontend/src/lib/offline-proxy/routes/libraries.ts - Offline proxy handlers
 * - frontend/src/services/api/main/endpoints.ts - Frontend endpoint definitions
 * - frontend/src/services/api/main/resources/libraries.ts - Frontend API methods
 */

import { Hono } from 'hono';
import type { HttpBindings } from '@hono/node-server';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { getUserId } from '../lib/auth-helper';
import { resolveCoverUrl } from '../lib/cover-url-helper';
import { getPinyinSort } from '../lib/pinyin-helper';
import {
  parseStreamingUpload,
  uploadCoverImage,
} from '../lib/services/upload.service';
import { getMinioClient } from '../lib/minio-client';
import {
  createLibrarySchema,
  updateLibrarySchema,
  libraryIdSchema,
  toLibraryResponse,
  toSongListResponse,
} from '@m3w/shared';
import type { Context } from 'hono';
import type { ApiResponse, Library, Song, SongSortOption, LibraryInput, SongInput } from '@m3w/shared';

// Compile-time constant injected by tsup for tree-shaking
declare const __IS_DEMO_BUILD__: boolean;

const app = new Hono<{ Bindings: HttpBindings }>();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// GET /api/libraries - List all libraries for current user
app.get('/', async (c: Context) => {
  try {
    const auth = c.get('auth');

    const libraries = await prisma.library.findMany({
      where: { userId: auth.userId },
      include: {
        songs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, coverUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to API response format using shared transformer
    const response = libraries.map((lib) => {
      const lastSong = lib.songs[0];
      const input: LibraryInput = {
        ...lib,
        coverUrl: lastSong ? resolveCoverUrl({ id: lastSong.id, coverUrl: lastSong.coverUrl }) : null,
      };
      return toLibraryResponse(input);
    });

    return c.json<ApiResponse<Library[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch libraries');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to fetch libraries',
      },
      500
    );
  }
});

// GET /api/libraries/:id - Get library by ID
app.get('/:id', async (c: Context) => {
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const auth = c.get('auth');

    const library = await prisma.library.findFirst({
      where: { id, userId: auth.userId },
      include: {
        songs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, coverUrl: true },
        },
      },
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

    // Transform to API response format using shared transformer
    const lastSong = library.songs[0];
    const input: LibraryInput = {
      ...library,
      coverUrl: lastSong ? resolveCoverUrl({ id: lastSong.id, coverUrl: lastSong.coverUrl }) : null,
    };

    return c.json<ApiResponse<Library>>({
      success: true,
      data: toLibraryResponse(input),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Invalid library ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error(error, 'Failed to fetch library');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to fetch library',
      },
      500
    );
  }
});

// POST /api/libraries - Create new library
app.post('/', async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createLibrarySchema.parse(body);
    const auth = c.get('auth');

    const library = await prisma.library.create({
      data: {
        ...data,
        userId: auth.userId,
        songCount: 0,
      },
    });

    // Transform to API response format
    const input: LibraryInput = {
      ...library,
      coverUrl: null,  // New library has no songs yet
    };

    return c.json<ApiResponse<Library>>(
      {
        success: true,
        data: toLibraryResponse(input),
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

    logger.error({ error }, 'Failed to create library');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to create library',
      },
      500
    );
  }
});

// PATCH /api/libraries/:id - Update library
app.patch('/:id', async (c: Context) => {
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const data = updateLibrarySchema.parse(body);
    const auth = c.get('auth');

    // Verify ownership
    const existing = await prisma.library.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    const library = await prisma.library.update({
      where: { id },
      data,
      include: {
        songs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, coverUrl: true },
        },
      },
    });

    // Transform to API response format
    const lastSong = library.songs[0];
    const input: LibraryInput = {
      ...library,
      coverUrl: lastSong ? resolveCoverUrl({ id: lastSong.id, coverUrl: lastSong.coverUrl }) : null,
    };

    return c.json<ApiResponse<Library>>({
      success: true,
      data: toLibraryResponse(input),
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

    logger.error({ error }, 'Failed to update library');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to update library',
      },
      500
    );
  }
});

// DELETE /api/libraries/:id - Delete library
app.delete('/:id', async (c: Context) => {
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const auth = c.get('auth');

    // Verify ownership
    const existing = await prisma.library.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    // Check if library can be deleted (protection for default library)
    if (!existing.canDelete) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Cannot delete default library',
        },
        403
      );
    }

    // Check if library has songs
    if (existing.songCount > 0) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Cannot delete library with songs',
        },
        400
      );
    }

    await prisma.library.delete({
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
          error: 'Invalid library ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to delete library');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to delete library',
      },
      500
    );
  }
});

// Helper function to sort songs
// Using a generic interface for sorting that works with Prisma results
interface SortableSong {
  title: string;
  artist: string | null;
  album: string | null;
  createdAt: Date;
}

function sortSongs<T extends SortableSong>(songs: T[], sortOption: SongSortOption): T[] {
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
      return sorted.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    
    case 'date-desc':
    default:
      return sorted.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}

// POST /api/libraries/:id/songs - Upload audio file to library (streaming)
// RESTful endpoint: libraryId from URL path enables validation BEFORE streaming
app.post('/:id/songs', async (c) => {
  try {
    const libraryId = c.req.param('id');
    const userId = getUserId(c);
    const bucketName = process.env.MINIO_BUCKET_NAME || 'm3w-music';

    // Validate library ownership BEFORE streaming starts (zero-cost validation failure)
    const library = await prisma.library.findFirst({
      where: { id: libraryId, userId },
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

    // Access Node.js IncomingMessage from Hono's env binding
    const nodeRequest = c.env.incoming;

    // Parse streaming upload using Node.js IncomingMessage
    const { fields, file } = await parseStreamingUpload(nodeRequest, bucketName);

    logger.info(
      { fileHash: file.hash, fileName: file.originalFilename, fileSize: file.size, libraryId },
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
            // Clean up uploaded file from MinIO before returning
            try {
              const minioClient = getMinioClient();
              await minioClient.removeObject(bucketName, file.objectName);
              logger.info({ objectName: file.objectName }, 'Cleaned up file after storage limit exceeded');
            } catch (cleanupError) {
              logger.warn({ error: cleanupError }, 'Failed to clean up file after storage limit check');
            }
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

// GET /api/libraries/:id/songs - List songs in library
app.get('/:id/songs', async (c: Context) => {
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const auth = c.get('auth');
    const sortParam = (c.req.query('sort') as SongSortOption) || 'date-desc';

    // Verify ownership
    const library = await prisma.library.findFirst({
      where: { id, userId: auth.userId },
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

    const songs = await prisma.song.findMany({
      where: { libraryId: id },
      include: {
        file: true,
        library: {
          select: { name: true },
        },
      },
    });

    // Apply sorting
    const sortedSongs = sortSongs(songs, sortParam);

    // Transform to API response format using shared transformer
    const songInputs: SongInput[] = sortedSongs.map(song => ({
      ...song,
      coverUrl: resolveCoverUrl({ id: song.id, coverUrl: song.coverUrl }),
    }));

    return c.json<ApiResponse<Song[]>>({
      success: true,
      data: toSongListResponse(songInputs),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Invalid library ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error, stack: error instanceof Error ? error.stack : undefined }, 'Failed to fetch library songs');
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to fetch library songs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default app;
