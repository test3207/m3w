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
import { createLogger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { getUserId } from '../lib/auth-helper';
import {
  parseStreamingUpload,
  uploadCoverImage,
} from '../services/upload.service';
import { getMinioClient } from '../lib/minio-client';
import {
  createLibrarySchema,
  updateLibrarySchema,
  libraryIdSchema,
  toLibraryResponse,
  toSongResponse,
  toSongListResponse,
} from '@m3w/shared';
import type { Context } from 'hono';
import type { ApiResponse, Library, Song, SongSortOption } from '@m3w/shared';
import {
  findUserLibraries,
  findLibraryById,
  createLibrary,
  updateLibrary,
  deleteLibrary,
  getLibrarySongs,
  findOrCreateFileRecord,
  checkExistingSongInLibrary,
  createSongWithFileRef,
} from '../services/library.service';

// Compile-time constant injected by tsup for tree-shaking
declare const __IS_DEMO_BUILD__: boolean;

const app = new Hono<{ Bindings: HttpBindings }>();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// GET /api/libraries - List all libraries for current user
app.get('/', async (c: Context) => {
  const log = createLogger(c);
  try {
    const auth = c.get('auth');
    const libraries = await findUserLibraries(auth.userId);
    const response = libraries.map(toLibraryResponse);

    return c.json<ApiResponse<Library[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    log.error({
      source: 'libraries.list',
      col1: 'library',
      col2: 'list',
      message: 'Failed to fetch libraries',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to fetch libraries' }, 500);
  }
});

// GET /api/libraries/:id - Get library by ID
app.get('/:id', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const auth = c.get('auth');
    const library = await findLibraryById(id, auth.userId);

    if (!library) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Library not found' }, 404);
    }

    return c.json<ApiResponse<Library>>({
      success: true,
      data: toLibraryResponse(library),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Invalid library ID', details: error.issues }, 400);
    }
    log.error({
      source: 'libraries.get',
      col1: 'library',
      col2: 'get',
      col3: c.req.param('id'),
      message: 'Failed to fetch library',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to fetch library' }, 500);
  }
});

// POST /api/libraries - Create new library
app.post('/', async (c: Context) => {
  const log = createLogger(c);
  try {
    const body = await c.req.json();
    const data = createLibrarySchema.parse(body);
    const auth = c.get('auth');
    const library = await createLibrary(auth.userId, data);

    return c.json<ApiResponse<Library>>({ success: true, data: toLibraryResponse(library) }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Validation failed', details: error.issues }, 400);
    }
    log.error({
      source: 'libraries.create',
      col1: 'library',
      col2: 'create',
      message: 'Failed to create library',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to create library' }, 500);
  }
});

// PATCH /api/libraries/:id - Update library
app.patch('/:id', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const data = updateLibrarySchema.parse(body);
    const auth = c.get('auth');
    const library = await updateLibrary(id, auth.userId, data);

    if (!library) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Library not found' }, 404);
    }

    return c.json<ApiResponse<Library>>({
      success: true,
      data: toLibraryResponse(library),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Validation failed', details: error.issues }, 400);
    }
    log.error({
      source: 'libraries.update',
      col1: 'library',
      col2: 'update',
      col3: c.req.param('id'),
      message: 'Failed to update library',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to update library' }, 500);
  }
});

// DELETE /api/libraries/:id - Delete library
app.delete('/:id', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const auth = c.get('auth');
    const result = await deleteLibrary(id, auth.userId);

    if (!result.deleted) {
      const status = result.error === 'Library not found' ? 404 
        : result.error === 'Cannot delete default library' ? 403 : 400;
      return c.json<ApiResponse<never>>({ success: false, error: result.error! }, status);
    }

    return c.json<ApiResponse<undefined>>({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Invalid library ID', details: error.issues }, 400);
    }
    log.error({
      source: 'libraries.delete',
      col1: 'library',
      col2: 'delete',
      col3: c.req.param('id'),
      message: 'Failed to delete library',
      error,
    });
    return c.json<ApiResponse<never>>({ success: false, error: 'Failed to delete library' }, 500);
  }
});

// POST /api/libraries/:id/songs - Upload audio file to library (streaming)
app.post('/:id/songs', async (c) => {
  const log = createLogger(c);
  try {
    const libraryId = c.req.param('id');
    const userId = getUserId(c);
    const bucketName = process.env.MINIO_BUCKET_NAME || 'm3w-music';

    // Validate library ownership BEFORE streaming starts
    const library = await findLibraryById(libraryId, userId);
    if (!library) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Library not found' }, 404);
    }

    // Access Node.js IncomingMessage from Hono's env binding
    const nodeRequest = c.env.incoming;
    const { fields, file } = await parseStreamingUpload(nodeRequest, bucketName);

    log.info({
      source: 'libraries.upload',
      col1: 'upload',
      col2: 'process',
      col3: libraryId,
      raw: { fileHash: file.hash, fileName: file.originalFilename, fileSize: file.size },
      message: 'Processing upload',
    });

    // Find or create file record
    const { fileRecord, isNewFile } = await findOrCreateFileRecord(file.hash, {
      objectName: file.objectName,
      size: file.size,
      mimeType: file.mimeType,
      metadata: file.metadata,
    });

    // Check storage limit for new files (Demo mode only)
    if (isNewFile && __IS_DEMO_BUILD__) {
      try {
        const { storageTracker } = await import('../lib/demo/storage-tracker');
        if (storageTracker.enabled && !storageTracker.canUpload(file.size)) {
          // Clean up uploaded file from MinIO
          try {
            const minioClient = getMinioClient();
            await minioClient.removeObject(bucketName, file.objectName);
            log.info({
              source: 'libraries.upload',
              col1: 'upload',
              col2: 'cleanup',
              raw: { objectName: file.objectName },
              message: 'Cleaned up file after storage limit exceeded',
            });
          } catch (cleanupError) {
            log.warn({
              source: 'libraries.upload',
              col1: 'upload',
              col2: 'cleanup',
              message: 'Failed to clean up file after storage limit check',
              error: cleanupError,
            });
          }
          return c.json({ success: false, error: 'Storage limit reached (5GB). Please wait for next reset.' }, 403);
        }
      } catch {
        log.debug({
          source: 'libraries.upload',
          col1: 'demo',
          col2: 'config',
          message: 'Demo modules not available',
        });
      }
    }

    // Increment storage usage for new files (Demo mode only)
    if (isNewFile && __IS_DEMO_BUILD__) {
      try {
        const { storageTracker } = await import('../lib/demo/storage-tracker');
        if (storageTracker.enabled) {
          storageTracker.incrementUsage(file.size);
        }
      } catch {
        log.debug({
          source: 'libraries.upload',
          col1: 'demo',
          col2: 'config',
          message: 'Demo modules not available for tracking',
        });
      }
    }

    // Upload cover image to MinIO if extracted
    let coverUrl: string | null = null;
    if (isNewFile && file.coverImage) {
      try {
        coverUrl = await uploadCoverImage(file.coverImage, file.hash, bucketName);
      } catch (error) {
        log.warn({
          source: 'libraries.upload',
          col1: 'upload',
          col2: 'cover',
          col3: file.hash,
          message: 'Failed to upload cover image',
          error,
        });
      }
    }

    // Build user metadata
    const metadata: {
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

    if (fields.artist) metadata.artist = fields.artist;
    if (fields.album) metadata.album = fields.album;
    if (fields.albumArtist) metadata.albumArtist = fields.albumArtist;
    if (fields.genre) metadata.genre = fields.genre;
    if (fields.composer) metadata.composer = fields.composer;
    if (coverUrl) metadata.coverUrl = coverUrl;
    else if (fields.coverUrl) metadata.coverUrl = fields.coverUrl;
    if (fields.year) metadata.year = parseInt(fields.year, 10);
    if (fields.trackNumber) metadata.trackNumber = parseInt(fields.trackNumber, 10);
    if (fields.discNumber) metadata.discNumber = parseInt(fields.discNumber, 10);

    // Check for duplicate song in library
    const existingCheck = await checkExistingSongInLibrary(libraryId, fileRecord.id);
    if (existingCheck.exists) {
      log.info({
        source: 'libraries.upload',
        col1: 'upload',
        col2: 'duplicate',
        col3: existingCheck.song!.id,
        raw: { libraryId },
        message: 'Song already exists in this library',
      });
      return c.json({
        success: false,
        error: 'This song already exists in the selected library',
        details: `"${existingCheck.song!.title}" is already in this library`,
      }, 409);
    }

    // Create song with file reference
    const songInput = await createSongWithFileRef(fileRecord.id, metadata);

    return c.json({
      success: true,
      data: { song: toSongResponse(songInput) },
    });
  } catch (error) {
    log.error({
      source: 'libraries.upload',
      col1: 'upload',
      col2: 'process',
      col3: c.req.param('id'),
      raw: { stack: error instanceof Error ? error.stack : undefined },
      message: 'Upload failed',
      error,
    });
    return c.json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// GET /api/libraries/:id/songs - List songs in library
app.get('/:id/songs', async (c: Context) => {
  const log = createLogger(c);
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const auth = c.get('auth');
    const sortParam = (c.req.query('sort') as SongSortOption) || 'date-desc';
    const songs = await getLibrarySongs(id, auth.userId, sortParam);

    if (!songs) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Library not found' }, 404);
    }

    return c.json<ApiResponse<Song[]>>({
      success: true,
      data: toSongListResponse(songs),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>({ success: false, error: 'Invalid library ID', details: error.issues }, 400);
    }
    log.error({
      source: 'libraries.songs',
      col1: 'library',
      col2: 'get',
      col3: c.req.param('id'),
      message: 'Failed to fetch library songs',
      error,
    });
    return c.json<ApiResponse<never>>({
      success: false,
      error: 'Failed to fetch library songs',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default app;
