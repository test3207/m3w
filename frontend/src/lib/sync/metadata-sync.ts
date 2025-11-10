/**
 * Metadata Sync Service
 * 
 * Automatically downloads libraries, playlists, and songs metadata from backend
 * to IndexedDB for offline use. Runs on app startup, periodically, and after PWA install.
 */

import { apiClient } from '../api/client';
import { db } from '../db/schema';
import type { Library, Playlist, Song } from '@m3w/shared';

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
    console.log('[MetadataSync] Starting metadata sync...');

    // Fetch all libraries
    const librariesResponse = await apiClient.get<{ success: boolean; data: Library[] }>('/libraries');
    const libraries = librariesResponse.data;
    
    await db.libraries.bulkPut(
      libraries.map((lib) => ({
        ...lib,
        createdAt: new Date(lib.createdAt),
        updatedAt: new Date(lib.updatedAt),
        _syncStatus: 'synced' as const,
      }))
    );
    console.log(`[MetadataSync] Synced ${libraries.length} libraries`);

    // Fetch all playlists
    const playlistsResponse = await apiClient.get<{ success: boolean; data: Playlist[] }>('/playlists');
    const playlists = playlistsResponse.data;
    
    await db.playlists.bulkPut(
      playlists.map((playlist) => ({
        ...playlist,
        createdAt: new Date(playlist.createdAt),
        updatedAt: new Date(playlist.updatedAt),
        _syncStatus: 'synced' as const,
      }))
    );
    console.log(`[MetadataSync] Synced ${playlists.length} playlists`);

    // Fetch songs for each library (batched)
    let totalSongs = 0;
    for (const library of libraries) {
      try {
        const songsResponse = await apiClient.get<{ success: boolean; data: Song[] }>(`/libraries/${library.id}/songs`);
        const songs = songsResponse.data;
        
        await db.songs.bulkPut(
          songs.map((song) => ({
            ...song,
            createdAt: new Date(song.createdAt),
            updatedAt: new Date(song.updatedAt),
            _syncStatus: 'synced' as const,
          }))
        );
        totalSongs += songs.length;
      } catch (error) {
        console.error(`[MetadataSync] Failed to sync songs for library ${library.id}:`, error);
      }
    }
    console.log(`[MetadataSync] Synced ${totalSongs} songs`);

    // Fetch playlist songs for each playlist (batched)
    let totalPlaylistSongs = 0;
    for (const playlist of playlists) {
      try {
        const playlistSongsResponse = await apiClient.get<{ success: boolean; data: Array<Song & { order?: number }> }>(`/playlists/${playlist.id}/songs`);
        const songs = playlistSongsResponse.data;
        
        // Store playlist-song relationships with order
        await db.playlistSongs.bulkPut(
          songs.map((song, index) => ({
            id: `${playlist.id}_${song.id}`,
            playlistId: playlist.id,
            songId: song.id,
            order: song.order ?? index,
            addedAt: new Date(),
            _syncStatus: 'synced' as const,
          }))
        );

        // Also store the songs themselves
        await db.songs.bulkPut(
          songs.map((song) => ({
            ...song,
            createdAt: new Date(song.createdAt),
            updatedAt: new Date(song.updatedAt),
            _syncStatus: 'synced' as const,
          }))
        );

        totalPlaylistSongs += songs.length;
      } catch (error) {
        console.error(`[MetadataSync] Failed to sync songs for playlist ${playlist.id}:`, error);
      }
    }
    console.log(`[MetadataSync] Synced ${totalPlaylistSongs} playlist songs`);

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
    console.error('[MetadataSync] Sync failed:', error);
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
    console.log('[MetadataSync] Auto-sync already running');
    return;
  }

  console.log('[MetadataSync] Starting auto-sync...');

  // Initial sync
  if (shouldSync()) {
    syncMetadata().catch(console.error);
  }

  // Periodic sync
  syncIntervalId = setInterval(() => {
    if (shouldSync()) {
      syncMetadata().catch(console.error);
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
    console.log('[MetadataSync] Auto-sync stopped');
  }
}

/**
 * Trigger sync manually
 */
export async function manualSync(): Promise<SyncResult> {
  console.log('[MetadataSync] Manual sync triggered');
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
