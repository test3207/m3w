/**
 * Offline Proxy with Hono
 * Handles user data routes (libraries, playlists, songs) with IndexedDB
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { db, addToSyncQueue } from '../db/schema';
import type { OfflineLibrary, OfflinePlaylist } from '../db/schema';
import {
  createLibrarySchema,
  updateLibrarySchema,
  createPlaylistSchema,
  updatePlaylistSchema,
} from '@m3w/shared';
import { parseBlob } from 'music-metadata';
import { calculateFileHash } from '../utils/hash';
import { cacheGuestAudio, cacheGuestCover } from '../pwa/cache-manager';
import type { OfflineSong } from '../db/schema';

const app = new Hono().basePath('/api');

// Helper to get userId from auth store
function getUserId(): string {
  // Zustand persist uses 'auth-storage' as the key name
  const authState = localStorage.getItem('auth-storage');
  if (!authState) {
    throw new Error('Not authenticated');
  }
  const { user } = JSON.parse(authState).state;
  return user?.id || '';
}

// ============================================
// Libraries Routes
// ============================================

// GET /api/libraries - List all libraries
app.get('/libraries', async (c: Context) => {
  try {
    const userId = getUserId();
    const libraries = await db.libraries
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');

    // Add song counts
    const librariesWithCounts = await Promise.all(
      libraries.map(async (library) => {
        const songCount = await db.songs.where('libraryId').equals(library.id).count();
        return {
          ...library,
          _count: {
            songs: songCount,
          },
        };
      })
    );

    return c.json({
      success: true,
      data: librariesWithCounts,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch libraries',
      },
      500
    );
  }
});

// GET /api/libraries/:id - Get library by ID
app.get('/libraries/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    // Check ownership (skip for guest to allow access to guest's own libraries)
    if (library.userId !== userId && userId !== 'guest') {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    // Add song count
    const songCount = await db.songs.where('libraryId').equals(id).count();
    const libraryWithCount = {
      ...library,
      _count: {
        songs: songCount,
      },
    };

    return c.json({
      success: true,
      data: libraryWithCount,
    });
  } catch (error) {
    console.error('[OfflineProxy] GET /libraries/:id error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch library',
      },
      500
    );
  }
});

// POST /api/libraries - Create new library
app.post('/libraries', async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createLibrarySchema.parse(body);
    const userId = getUserId();

    const library: OfflineLibrary = {
      id: crypto.randomUUID(),
      ...data,
      description: data.description ?? null,
      userId,
      isDefault: false,
      canDelete: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { songs: 0 },
      _syncStatus: 'pending',
    };

    await db.libraries.add(library);
    
    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'library',
        entityId: library.id,
        operation: 'create',
        data: library,
      });
    }

    return c.json(
      {
        success: true,
        data: library,
        message: 'Library created (will sync when online)',
      },
      201
    );
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to create library',
      },
      500
    );
  }
});

// PATCH /api/libraries/:id - Update library
app.patch('/libraries/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const data = updateLibrarySchema.parse(body);
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library || library.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    const updated: OfflineLibrary = {
      ...library,
      ...data,
      updatedAt: new Date().toISOString(),
      _syncStatus: 'pending',
    };

    await db.libraries.put(updated);
    
    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'library',
        entityId: id,
        operation: 'update',
        data: updated,
      });
    }

    return c.json({
      success: true,
      data: updated,
      message: 'Library updated (will sync when online)',
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to update library',
      },
      500
    );
  }
});

// DELETE /api/libraries/:id - Delete library
app.delete('/libraries/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library || library.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    await db.libraries.delete(id);
    
    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'library',
        entityId: id,
        operation: 'delete',
      });
    }

    return c.json({
      success: true,
      message: 'Library deleted (will sync when online)',
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to delete library',
      },
      500
    );
  }
});

// GET /api/libraries/:id/songs - Get songs in library
app.get('/libraries/:id/songs', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library || library.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    const songs = await db.songs.where('libraryId').equals(id).toArray();

    return c.json({
      success: true,
      data: songs,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch songs',
      },
      500
    );
  }
});

// ============================================
// Playlists Routes
// ============================================

// GET /api/playlists - List all playlists
app.get('/playlists', async (c: Context) => {
  try {
    const userId = getUserId();
    const playlists = await db.playlists
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');

    // Add song counts
    const playlistsWithCounts = await Promise.all(
      playlists.map(async (playlist) => {
        const songCount = await db.playlistSongs.where('playlistId').equals(playlist.id).count();
        return {
          ...playlist,
          _count: {
            songs: songCount,
          },
        };
      })
    );

    return c.json({
      success: true,
      data: playlistsWithCounts,
    });
  } catch {
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
app.get('/playlists/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Add song count
    const songCount = await db.playlistSongs.where('playlistId').equals(id).count();

    return c.json({
      success: true,
      data: {
        ...playlist,
        _count: {
          songs: songCount,
        },
      },
    });
  } catch {
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
app.post('/playlists', async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createPlaylistSchema.parse(body);
    const userId = getUserId();

    const playlist: OfflinePlaylist = {
      id: crypto.randomUUID(),
      ...data,
      description: data.description ?? null,
      userId,
      songIds: [],
      isDefault: false,
      canDelete: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { songs: 0 },
      _syncStatus: 'pending',
    };

    await db.playlists.add(playlist);
    
    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlist',
        entityId: playlist.id,
        operation: 'create',
        data: playlist,
      });
    }

    return c.json(
      {
        success: true,
        data: playlist,
        message: 'Playlist created (will sync when online)',
      },
      201
    );
  } catch {
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
app.patch('/playlists/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const data = updatePlaylistSchema.parse(body);
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    const updated: OfflinePlaylist = {
      ...playlist,
      ...data,
      updatedAt: new Date().toISOString(),
      _syncStatus: 'pending',
    };

    await db.playlists.put(updated);
    
    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlist',
        entityId: id,
        operation: 'update',
        data: updated,
      });
    }

    return c.json({
      success: true,
      data: updated,
      message: 'Playlist updated (will sync when online)',
    });
  } catch {
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
app.delete('/playlists/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    await db.playlists.delete(id);
    
    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlist',
        entityId: id,
        operation: 'delete',
      });
    }

    return c.json({
      success: true,
      message: 'Playlist deleted (will sync when online)',
    });
  } catch {
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
app.get('/playlists/:id/songs', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Get playlist songs from IndexedDB
    const playlistSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .sortBy('order');

    // Get full song details
    const songs = await Promise.all(
      playlistSongs.map(async (ps) => {
        const song = await db.songs.get(ps.songId);
        return song;
      })
    );

    // Filter out any songs that weren't found
    const validSongs = songs.filter((song) => song !== undefined);

    return c.json({
      success: true,
      data: validSongs,
    });
  } catch {
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
app.post('/playlists/:id/songs', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { songId } = body;
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    const song = await db.songs.get(songId);

    if (!song) {
      return c.json(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }

    // Get current max order
    const existingSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .toArray();

    const maxOrder = existingSongs.length > 0
      ? Math.max(...existingSongs.map((ps) => ps.order))
      : 0;

    // Add to playlist
    const playlistSong = {
      id: crypto.randomUUID(),
      playlistId: id,
      songId,
      order: maxOrder + 1,
      addedAt: new Date(),
      _syncStatus: 'pending' as const,
    };

    await db.playlistSongs.add(playlistSong);
    
    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlistSong',
        entityId: playlistSong.id,
        operation: 'create',
        data: playlistSong,
      });
    }

    return c.json(
      {
        success: true,
        data: playlistSong,
        message: 'Song added to playlist (will sync when online)',
      },
      201
    );
  } catch {
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
app.delete('/playlists/:id/songs/:songId', async (c: Context) => {
  try {
    const playlistId = c.req.param('id');
    const songId = c.req.param('songId');
    const userId = getUserId();

    const playlist = await db.playlists.get(playlistId);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Find the playlist song entry
    const playlistSong = await db.playlistSongs
      .where('[playlistId+songId]')
      .equals([playlistId, songId])
      .first();

    if (!playlistSong) {
      return c.json(
        {
          success: false,
          error: 'Song not in playlist',
        },
        404
      );
    }

    await db.playlistSongs.delete(playlistSong.id);
    
    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlistSong',
        entityId: playlistSong.id,
        operation: 'delete',
      });
    }

    return c.json({
      success: true,
      message: 'Song removed from playlist (will sync when online)',
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to remove song from playlist',
      },
      500
    );
  }
});

// GET /api/playlists/by-library/:libraryId - Get playlist linked to library
app.get('/playlists/by-library/:libraryId', async (c: Context) => {
  try {
    const libraryId = c.req.param('libraryId');
    const userId = getUserId();

    // Find playlist with linkedLibraryId
    const playlist = await db.playlists
      .where('linkedLibraryId')
      .equals(libraryId)
      .first();

    if (!playlist) {
      return c.json({
        success: true,
        data: null,
      });
    }

    if (playlist.userId !== userId) {
      return c.json({
        success: true,
        data: null,
      });
    }

    // Add song count
    const songCount = await db.playlistSongs.where('playlistId').equals(playlist.id).count();

    return c.json({
      success: true,
      data: {
        ...playlist,
        _count: {
          songs: songCount,
        },
      },
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch library playlist',
      },
      500
    );
  }
});

// POST /api/playlists/for-library - Create playlist linked to library
app.post('/playlists/for-library', async (c: Context) => {
  try {
    const body = await c.req.json();
    const { name, linkedLibraryId, songIds } = body;
    const userId = getUserId();

    const playlist: OfflinePlaylist = {
      id: crypto.randomUUID(),
      name,
      description: null,
      userId,
      songIds: songIds || [],
      linkedLibraryId,
      isDefault: false,
      canDelete: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { songs: songIds?.length || 0 },
      _syncStatus: 'pending',
    };

    await db.playlists.add(playlist);

    // Add playlist songs
    if (songIds && songIds.length > 0) {
      await Promise.all(
        songIds.map((songId: string, index: number) =>
          db.playlistSongs.add({
            id: crypto.randomUUID(),
            playlistId: playlist.id,
            songId,
            order: index + 1,
            addedAt: new Date(),
            _syncStatus: 'pending' as const,
          })
        )
      );
    }
    
    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlist',
        entityId: playlist.id,
        operation: 'create',
        data: playlist,
      });
    }

    return c.json(
      {
        success: true,
        data: playlist,
        message: 'Library playlist created (will sync when online)',
      },
      201
    );
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to create library playlist',
      },
      500
    );
  }
});

// PUT /api/playlists/:id/songs - Update playlist songs (batch)
app.put('/playlists/:id/songs', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { songIds } = body;
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Delete existing playlist songs
    const existingSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .toArray();
    await Promise.all(existingSongs.map((ps) => db.playlistSongs.delete(ps.id)));

    // Add new songs
    if (songIds && songIds.length > 0) {
      await Promise.all(
        songIds.map((songId: string, index: number) =>
          db.playlistSongs.add({
            id: crypto.randomUUID(),
            playlistId: id,
            songId,
            order: index + 1,
            addedAt: new Date(),
            _syncStatus: 'pending' as const,
          })
        )
      );
    }

    // Update playlist songIds
    const updated: OfflinePlaylist = {
      ...playlist,
      songIds,
      updatedAt: new Date().toISOString(),
      _syncStatus: 'pending',
    };
    await db.playlists.put(updated);
    
    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlist',
        entityId: id,
        operation: 'update',
        data: updated,
      });
    }

    return c.json({
      success: true,
      message: 'Playlist songs updated (will sync when online)',
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to update playlist songs',
      },
      500
    );
  }
});

// POST /api/playlists/:id/songs/reorder - Reorder songs in playlist
app.post('/playlists/:id/songs/reorder', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { songId, direction } = body;
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: 'Playlist not found',
        },
        404
      );
    }

    // Get all playlist songs sorted by order
    const playlistSongs = await db.playlistSongs
      .where('playlistId')
      .equals(id)
      .sortBy('order');

    // Find the song to move
    const currentIndex = playlistSongs.findIndex((ps) => ps.songId === songId);

    if (currentIndex === -1) {
      return c.json(
        {
          success: false,
          error: 'Song not in playlist',
        },
        404
      );
    }

    // Calculate new index
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Check boundaries
    if (newIndex < 0 || newIndex >= playlistSongs.length) {
      return c.json({
        success: true,
        message: 'Song is already at the boundary',
      });
    }

    // Swap orders
    const currentSong = playlistSongs[currentIndex];
    const adjacentSong = playlistSongs[newIndex];

    const tempOrder = currentSong.order;
    currentSong.order = adjacentSong.order;
    adjacentSong.order = tempOrder;
    currentSong._syncStatus = 'pending';
    adjacentSong._syncStatus = 'pending';

    // Update both songs
    await db.playlistSongs.put(currentSong);
    await db.playlistSongs.put(adjacentSong);

    // Only queue sync for authenticated users
    if (userId !== 'guest') {
      await addToSyncQueue({
        entityType: 'playlistSong',
        entityId: currentSong.id,
        operation: 'update',
        data: currentSong,
      });
      await addToSyncQueue({
        entityType: 'playlistSong',
        entityId: adjacentSong.id,
        operation: 'update',
        data: adjacentSong,
      });
    }

    return c.json({
      success: true,
      message: 'Songs reordered (will sync when online)',
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to reorder songs',
      },
      500
    );
  }
});

// ============================================
// Songs Routes
// ============================================

// GET /api/songs/:id - Get song by ID
app.get('/songs/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const song = await db.songs.get(id);

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
  } catch {
    return c.json(
      {
        success: false,
        error: 'Failed to fetch song',
      },
      500
    );
  }
});

// GET /api/songs/:id/stream - Deprecated
// Guest mode now uses /guest/songs/:id/stream served by Service Worker
// This route kept for backward compatibility but will return 404

// ============================================
// Upload Routes
// ============================================

// POST /api/upload - Upload audio file (Offline)
app.post('/upload', async (c: Context) => {
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

    // 3. Generate song ID (needed for cache URLs)
    const songId = crypto.randomUUID();

    // 4. Extract cover art if available and cache it
    let coverUrl: string | null = null;
    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      // Convert Uint8Array to Blob
      const coverBlob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
      
      // Cache cover in Cache Storage and get guest URL
      coverUrl = await cacheGuestCover(songId, coverBlob);
    }

    // 4. Cache audio file in Cache Storage
    const streamUrl = await cacheGuestAudio(songId, file);

    // 5. Create Song object
    const now = new Date().toISOString();

    const song: OfflineSong = {
      id: songId,
      title: common.title || file.name.replace(/\.[^/.]+$/, ""),
      artist: common.artist || "Unknown Artist",
      album: common.album || "Unknown Album",
      albumArtist: common.albumartist || null,
      year: common.year || null,
      genre: common.genre && common.genre.length > 0 ? common.genre[0] : null,
      trackNumber: common.track.no || null,
      discNumber: common.disk.no || null,
      composer: common.composer && common.composer.length > 0 ? common.composer[0] : null,
      coverUrl: coverUrl || null,
      streamUrl, // Guest URL: /guest/songs/{id}/stream
      fileId: hash, // Use hash as fileId for local
      libraryId,
      createdAt: now,
      updatedAt: now,
      file: {
        id: hash,
        hash: hash,
        path: 'local',
        size: file.size,
        mimeType: file.type,
        duration: format.duration || 0,
        bitrate: format.bitrate || 0,
        sampleRate: format.sampleRate || 0,
        channels: format.numberOfChannels || 0,
      },
      // No longer store blobs in IndexedDB
      _syncStatus: 'pending',
    };

    // 6. Save metadata to IndexedDB
    await db.songs.add(song);

    return c.json({
      success: true,
      data: {
        song,
        isDuplicate: false
      }
    });

  } catch (error) {
    console.error('Offline upload failed', error);
    return c.json({ success: false, error: 'Upload failed' }, 500);
  }
});

// ============================================
// Player Routes (Guest Mode - IndexedDB backed)
// ============================================

// GET /api/player/progress - Get playback progress
app.get('/player/progress', async (c: Context) => {
  try {
    const userId = getUserId();
    const progress = await db.playerProgress.get(userId);
    
    if (!progress) {
      return c.json({
        success: true,
        data: null
      });
    }
    
    // Get song details from IndexedDB
    const song = await db.songs.get(progress.songId);
    if (!song) {
      return c.json({
        success: true,
        data: null
      });
    }
    
    // Determine context (library or playlist)
    let context = null;
    
    // Try to find which playlist contains this song
    const playlists = await db.playlists
      .where('userId')
      .equals(userId)
      .toArray();
    
    const playlistWithSong = playlists.find(p => 
      p.songIds && p.songIds.includes(song.id)
    );
    
    if (playlistWithSong) {
      context = {
        type: 'playlist',
        id: playlistWithSong.id,
        name: playlistWithSong.name,
      };
    } else if (song.libraryId) {
      // Fallback to library
      const library = await db.libraries.get(song.libraryId);
      if (library) {
        context = {
          type: 'library',
          id: library.id,
          name: library.name,
        };
      }
    }
    
    // Return in backend API format
    return c.json({
      success: true,
      data: {
        track: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          coverUrl: song.coverUrl,
          duration: progress.duration,
          mimeType: 'audio/mpeg',
        },
        position: progress.position,
        context,
        updatedAt: progress.updatedAt.toISOString(),
      }
    });
  } catch {
    return c.json({
      success: true,
      data: null
    });
  }
});

// PUT /api/player/progress - Sync playback progress
app.put('/player/progress', async (c: Context) => {
  try {
    const userId = getUserId();
    const body = await c.req.json();
    
    // Extract fields from request body
    const { songId, position } = body;
    
    // Get current song to determine duration
    const song = await db.songs.get(songId);
    const duration = song?.file?.duration ?? 0;
    
    await db.playerProgress.put({
      userId,
      songId,
      position,
      duration,
      updatedAt: new Date(),
    });
    
    return c.json({
      success: true,
      data: { synced: true }
    });
  } catch {
    return c.json({
      success: false,
      error: 'Failed to save progress'
    }, 500);
  }
});

// GET /api/player/seed - Get default playback seed
app.get('/player/seed', async (c: Context) => {
  try {
    const userId = getUserId();
    
    // Try to find first playlist with songs
    const playlists = await db.playlists
      .where('userId')
      .equals(userId)
      .sortBy('createdAt');
    
    for (const playlist of playlists) {
      if (playlist.songIds && playlist.songIds.length > 0) {
        const firstSongId = playlist.songIds[0];
        const song = await db.songs.get(firstSongId);
        
        if (song) {
          return c.json({
            success: true,
            data: {
              track: {
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                coverUrl: song.coverUrl,
                mimeType: 'audio/mpeg',
                duration: null,
              },
              context: {
                type: 'playlist',
                id: playlist.id,
                name: playlist.name,
              }
            }
          });
        }
      }
    }
    
    // Fallback to first library with songs
    const libraries = await db.libraries
      .where('userId')
      .equals(userId)
      .sortBy('createdAt');
    
    for (const library of libraries) {
      const songs = await db.songs
        .where('libraryId')
        .equals(library.id)
        .limit(1)
        .toArray();
      
      const song = songs[0];
      if (song) {
        return c.json({
          success: true,
          data: {
            track: {
              id: song.id,
              title: song.title,
              artist: song.artist,
              album: song.album,
              coverUrl: song.coverUrl,
              mimeType: 'audio/mpeg',
              duration: null,
            },
            context: {
              type: 'library',
              id: library.id,
              name: library.name,
            }
          }
        });
      }
    }
    
    // No seed available
    return c.json({
      success: true,
      data: null
    });
  } catch {
    return c.json({
      success: true,
      data: null
    });
  }
});

// GET /api/player/preferences - Get user preferences
app.get('/player/preferences', async (c: Context) => {
  try {
    const userId = getUserId();
    const preferences = await db.playerPreferences.get(userId);
    
    return c.json({
      success: true,
      data: preferences || {
        volume: 1,
        muted: false,
        repeatMode: 'off',
        shuffleEnabled: false
      }
    });
  } catch {
    return c.json({
      success: true,
      data: {
        volume: 1,
        muted: false,
        repeatMode: 'off',
        shuffleEnabled: false
      }
    });
  }
});

// PATCH /api/player/preferences - Update user preferences
app.patch('/player/preferences', async (c: Context) => {
  try {
    const userId = getUserId();
    const body = await c.req.json();
    const current = await db.playerPreferences.get(userId);
    
    const updated = {
      userId,
      volume: body.volume ?? current?.volume ?? 1,
      muted: body.muted ?? current?.muted ?? false,
      repeatMode: body.repeatMode ?? current?.repeatMode ?? 'off',
      shuffleEnabled: body.shuffleEnabled ?? current?.shuffleEnabled ?? false,
      updatedAt: new Date(),
    };
    
    await db.playerPreferences.put(updated);
    
    return c.json({
      success: true,
      data: { updated: true }
    });
  } catch {
    return c.json({
      success: false,
      error: 'Failed to update preferences'
    }, 500);
  }
});

// PUT /api/player/preferences - Update user preferences (alias for PATCH)
app.put('/player/preferences', async (c: Context) => {
  try {
    const userId = getUserId();
    const body = await c.req.json();
    const current = await db.playerPreferences.get(userId);
    
    const updated = {
      userId,
      volume: body.volume ?? current?.volume ?? 1,
      muted: body.muted ?? current?.muted ?? false,
      repeatMode: body.repeatMode ?? current?.repeatMode ?? 'off',
      shuffleEnabled: body.shuffleEnabled ?? current?.shuffleEnabled ?? false,
      updatedAt: new Date(),
    };
    
    await db.playerPreferences.put(updated);
    
    return c.json({
      success: true,
      data: { updated: true }
    });
  } catch {
    return c.json({
      success: false,
      error: 'Failed to update preferences'
    }, 500);
  }
});

export default app;
