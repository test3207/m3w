/**
 * Upload routes for offline-proxy
 * 
 * All cache operations use /api/ URLs as cache keys.
 * This ensures cache compatibility when user switches from Guest to Auth mode.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { db } from '../../db/schema';
import type { OfflineSong } from '../../db/schema';
import { parseBlob } from 'music-metadata';
import { calculateFileHash } from '../../utils/hash';
import { cacheAudioForOffline, cacheCoverForOffline } from '../../pwa/cache-manager';

const app = new Hono();

// POST /upload - Upload audio file (Offline)
app.post('/', async (c: Context) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const libraryId = formData.get('libraryId') as string;

    if (!file || !libraryId) {
      return c.json({ success: false, error: 'Missing file or libraryId' }, 400);
    }

    // 1. Calculate hash
    const hash = await calculateFileHash(file);

    // 2. Extract metadata
    const metadata = await parseBlob(file);
    const { common, format } = metadata;

    // 3. Check if File entity exists or create new one
    let fileEntity = await db.files.where('hash').equals(hash).first();

    if (!fileEntity) {
      // Create new File entity
      fileEntity = {
        id: `file-${hash}`,
        hash,
        size: file.size,
        mimeType: file.type || 'audio/mpeg',
        duration: format.duration || undefined,
        refCount: 0, // Will be incremented below
        createdAt: new Date(),
      };
      await db.files.add(fileEntity);
    }

    // 4. Generate song ID (needed for cache URLs)
    const songId = crypto.randomUUID();

    // 5. Extract cover art if available and cache it
    let coverUrl: string | null = null;
    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      // Convert Uint8Array to Blob
      const coverBlob = new Blob([new Uint8Array(picture.data)], {
        type: picture.format,
      });

      // Cache cover in Cache Storage using unified /api/ URL
      coverUrl = await cacheCoverForOffline(songId, coverBlob);
    }

    // 6. Cache audio file in Cache Storage using unified /api/ URL
    const streamUrl = await cacheAudioForOffline(songId, file);

    // 7. Create Song object
    const now = new Date().toISOString();

    const song: OfflineSong = {
      id: songId,
      libraryId, // ✅ Required field (one-to-many relationship)
      title: common.title || file.name.replace(/\.[^/.]+$/, ''),
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      albumArtist: common.albumartist || null,
      year: common.year || null,
      genre: common.genre && common.genre.length > 0 ? common.genre[0] : null,
      trackNumber: common.track.no || null,
      discNumber: common.disk.no || null,
      composer:
        common.composer && common.composer.length > 0 ? common.composer[0] : null,
      coverUrl: coverUrl || null,
      streamUrl, // Unified URL: /api/songs/{id}/stream (works for both Guest and Auth)
      fileId: fileEntity.id, // Reference to File entity
      duration: format.duration || null,
      mimeType: fileEntity.mimeType, // Audio format (audio/mpeg, audio/flac, etc.)
      createdAt: now,
      updatedAt: now,
      // Cache status fields
      isCached: true,
      cacheSize: file.size, // Set cache size to file size
      lastCacheCheck: Date.now(),
      fileHash: hash, // Keep for quick lookup
      // No longer store blobs in IndexedDB
      _syncStatus: 'pending',
    };

    // 8. Save song to IndexedDB and increment File refCount
    await db.transaction('rw', [db.songs, db.files], async () => {
      await db.songs.add(song);

      // Increment refCount
      await db.files.update(fileEntity!.id, {
        refCount: fileEntity!.refCount + 1,
      });
    });

    // Song.libraryId is the direct relationship (one-to-many)

    return c.json({
      success: true,
      data: {
        song,
        isDuplicate: false,
      },
    });
  } catch (error) {
    console.error('Offline upload failed', error);
    return c.json({ success: false, error: 'Upload failed' }, 500);
  }
});

export { app as uploadRoutes };
