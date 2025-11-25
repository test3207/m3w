/**
 * Metadata Sync Service
 * 
 * Automatically downloads libraries, playlists, and songs metadata from backend
 * to IndexedDB for offline use. Runs on app startup, periodically, and after PWA install.
 */

import { api } from '@/services';
import { db } from '../db/schema';
import { logger } from '../logger-client';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SYNC_STORAGE_KEY = 'm3w_last_sync_timestamp';

export interface SyncResult {
  success: boolean;
  libraries?: number;
  playlists?: number;
  songs?: number;
  playlistSongs?: number;
  error?: string;
}

/**
 * Get last sync timestamp from localStorage
 */
function getLastSyncTime(): number | null {
  const stored = localStorage.getItem(SYNC_STORAGE_KEY);
  return stored ? parseInt(stored, 10) : null;
}

/**
 * Update last sync timestamp in localStorage
 */
function setLastSyncTime(timestamp: number): void {
  localStorage.setItem(SYNC_STORAGE_KEY, timestamp.toString());
}

/**
 * Sync all metadata from backend to IndexedDB
 */
export async function syncMetadata(): Promise<SyncResult> {
  try {
    logger.info('Starting metadata sync');

    // Fetch all libraries
    const libraries = await api.main.libraries.list();

    await db.libraries.bulkPut(
      libraries.map((lib) => ({
        ...lib,
        _syncStatus: 'synced' as const,
      }))
    );
    logger.info('Libraries synced', { count: libraries.length });

    // Fetch all playlists
    const playlists = await api.main.playlists.list();

    await db.playlists.bulkPut(
      playlists.map((playlist) => ({
        ...playlist,
        _syncStatus: 'synced' as const,
      }))
    );
    logger.info('Playlists synced', { count: playlists.length });

    // Fetch songs for each library (batched)
    let totalSongs = 0;
    for (const library of libraries) {
      try {
        const songs = await api.main.libraries.getSongs(library.id);

        // Merge with existing cache status to preserve offline data
        const mergedSongs = await Promise.all(
          songs.map(async (song) => {
            const existing = await db.songs.get(song.id);
            return {
              ...song,
              // Preserve existing cache fields or set defaults
              isCached: existing?.isCached ?? false,
              cacheSize: existing?.cacheSize,
              lastCacheCheck: existing?.lastCacheCheck ?? 0,
              fileHash: existing?.fileHash ?? song.file?.hash, // Use server hash if available
              _syncStatus: 'synced' as const,
            };
          })
        );

        await db.songs.bulkPut(mergedSongs);
        totalSongs += songs.length;
      } catch (error) {
        logger.error('Failed to sync library songs', { libraryId: library.id, error });
      }
    }
    logger.info('Songs synced', { totalSongs });

    // Fetch playlist songs for each playlist (batched)
    let totalPlaylistSongs = 0;
    for (const playlist of playlists) {
      try {
        const songs = await api.main.playlists.getSongs(playlist.id);

        // Store playlist-song relationships with order
        await db.playlistSongs.bulkPut(
          songs.map((song, index) => ({
            id: `${playlist.id}_${song.id}`,
            playlistId: playlist.id,
            songId: song.id,
            order: index, // Use index since Song doesn't have order field
            addedAt: new Date(),
            _syncStatus: 'synced' as const,
          }))
        );

        // Also store the songs themselves (preserve cache status)
        const mergedSongs = await Promise.all(
          songs.map(async (song) => {
            const existing = await db.songs.get(song.id);
            return {
              ...song,
              // Preserve existing cache fields or set defaults
              isCached: existing?.isCached ?? false,
              cacheSize: existing?.cacheSize,
              lastCacheCheck: existing?.lastCacheCheck ?? 0,
              fileHash: existing?.fileHash ?? song.file?.hash, // Use server hash if available
              _syncStatus: 'synced' as const,
            };
          })
        );

        await db.songs.bulkPut(mergedSongs);

        totalPlaylistSongs += songs.length;
      } catch (error) {
        logger.error('Failed to sync playlist songs', { playlistId: playlist.id, error });
      }
    }
    logger.info('Playlist songs synced', { totalPlaylistSongs });

    // Update last sync timestamp
    setLastSyncTime(Date.now());

    return {
      success: true,
      libraries: libraries.length,
      playlists: playlists.length,
      songs: totalSongs,
      playlistSongs: totalPlaylistSongs,
    };
  } catch (error) {
    logger.error('Metadata sync failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if sync is needed based on last sync time
 */
export function shouldSync(forceSync: boolean = false): boolean {
  if (forceSync) return true;

  const lastSync = getLastSyncTime();
  if (!lastSync) return true; // Never synced before

  const timeSinceLastSync = Date.now() - lastSync;
  return timeSinceLastSync >= SYNC_INTERVAL;
}

/**
 * Start automatic periodic sync
 */
let syncIntervalId: NodeJS.Timeout | null = null;

export function startAutoSync(): void {
  if (syncIntervalId) {
    logger.info('Auto-sync already running');
    return;
  }

  logger.info('Starting auto-sync');

  // Initial sync
  if (shouldSync()) {
    syncMetadata().catch((error) => logger.error('Auto-sync failed', { error }));
  }

  // Periodic sync
  syncIntervalId = setInterval(() => {
    if (shouldSync()) {
      syncMetadata().catch((error) => logger.error('Auto-sync failed', { error }));
    }
  }, SYNC_INTERVAL);
}

/**
 * Stop automatic periodic sync
 */
export function stopAutoSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    logger.info('Auto-sync stopped');
  }
}

/**
 * Trigger sync manually
 */
export async function manualSync(): Promise<SyncResult> {
  logger.info('Manual sync triggered');
  return syncMetadata();
}

/**
 * Get sync status information
 */
export interface SyncStatus {
  lastSyncTime: number | null;
  lastSyncTimeFormatted: string | null;
  shouldSync: boolean;
  autoSyncRunning: boolean;
}

export function getSyncStatus(): SyncStatus {
  const lastSync = getLastSyncTime();
  return {
    lastSyncTime: lastSync,
    lastSyncTimeFormatted: lastSync ? new Date(lastSync).toLocaleString() : null,
    shouldSync: shouldSync(),
    autoSyncRunning: syncIntervalId !== null,
  };
}
