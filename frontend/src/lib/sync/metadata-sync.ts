/**
 * Metadata Sync Service
 * 
 * Handles periodic and event-driven metadata sync from backend to IndexedDB.
 * Works in conjunction with router-level caching:
 * - Router caching: Real-time cache on each GET request
 * - This service: Background sync for data freshness and completeness
 * 
 * Sync triggers:
 * - App startup (initial sync)
 * - Online event (when reconnecting)
 * - Manual trigger (Settings page button)
 * - Optional periodic sync (user configurable)
 * 
 * This is a PULL-only service. Auth users never push local changes.
 * Backend is the source of truth.
 */

import { api } from "@/services";
import { useAuthStore } from "@/stores/authStore";
import { logger } from "../logger-client";
import {
  cacheLibraries,
  cachePlaylists,
  cacheSongsForLibrary,
  cacheSongsForPlaylist,
  deleteStaleSongs,
  getLastSyncTime,
  setLastSyncTime,
} from "../cache/metadata-cache";

const DEFAULT_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SYNC_SETTINGS_KEY = "m3w_sync_settings";

export interface SyncResult {
  success: boolean;
  libraries?: number;
  playlists?: number;
  songs?: number;
  error?: string;
}

export interface SyncSettings {
  /** Auto sync mode: always, manual only */
  autoSync: boolean;
  /** Sync interval in milliseconds (0 = disabled) */
  syncInterval: number;
}

/**
 * Get sync settings from localStorage
 */
export function getSyncSettings(): SyncSettings {
  try {
    const stored = localStorage.getItem(SYNC_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  // Defaults
  return {
    autoSync: true,
    syncInterval: DEFAULT_SYNC_INTERVAL,
  };
}

/**
 * Save sync settings to localStorage
 */
export function setSyncSettings(settings: SyncSettings): void {
  localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Update partial sync settings and restart service if needed
 */
export function updateSyncSettings(updates: Partial<SyncSettings>): void {
  const current = getSyncSettings();
  const newSettings = { ...current, ...updates };
  setSyncSettings(newSettings);
  
  // If autoSync setting changed, restart service accordingly
  if (updates.autoSync !== undefined) {
    if (updates.autoSync) {
      restartAutoSync();
    } else {
      stopAutoSync();
    }
  } else if (updates.syncInterval !== undefined && current.autoSync) {
    // If interval changed while autoSync is on, restart with new interval
    restartAutoSync();
  }
  
  // Notify listeners of settings change
  notifySyncStatusChange();
}

// Sync status change listeners
type SyncStatusListener = () => void;
const syncStatusListeners = new Set<SyncStatusListener>();

/**
 * Subscribe to sync status changes
 */
export function onSyncStatusChange(listener: SyncStatusListener): () => void {
  syncStatusListeners.add(listener);
  return () => syncStatusListeners.delete(listener);
}

/**
 * Notify listeners of sync status change
 */
function notifySyncStatusChange(): void {
  syncStatusListeners.forEach(listener => listener());
}

/**
 * Full metadata sync - fetches all data from backend
 * This is more thorough than router caching as it ensures all data is synced,
 * including data the user hasn't navigated to yet.
 */
export async function syncMetadata(): Promise<SyncResult> {
  try {
    logger.info("[MetadataSync] Starting full sync");

    // Fetch and cache all libraries
    const libraries = await api.main.libraries.list();
    await cacheLibraries(libraries);

    // Fetch and cache all playlists
    const playlists = await api.main.playlists.list();
    await cachePlaylists(playlists);

    // Collect all server song IDs for stale detection
    const serverSongIds = new Set<string>();

    // Fetch songs for each library
    let totalSongs = 0;
    for (const library of libraries) {
      try {
        const songs = await api.main.libraries.getSongs(library.id);
        songs.forEach(song => serverSongIds.add(song.id));
        await cacheSongsForLibrary(library.id, songs);
        totalSongs += songs.length;
      } catch (error) {
        logger.error("[MetadataSync] Failed to sync library songs", { libraryId: library.id, error });
      }
    }

    // Fetch songs for each playlist
    for (const playlist of playlists) {
      try {
        const songs = await api.main.playlists.getSongs(playlist.id);
        songs.forEach(song => serverSongIds.add(song.id));
        await cacheSongsForPlaylist(playlist.id, songs);
      } catch (error) {
        logger.error("[MetadataSync] Failed to sync playlist songs", { playlistId: playlist.id, error });
      }
    }

    // Clean up stale songs (only from owned libraries)
    const userId = useAuthStore.getState().user?.id;
    const ownedLibraryIds = new Set(
      libraries.filter(lib => lib.userId === userId).map(lib => lib.id)
    );
    await deleteStaleSongs(serverSongIds, ownedLibraryIds);

    // Update last sync timestamp
    setLastSyncTime(Date.now());

    logger.info("[MetadataSync] Full sync completed", {
      libraries: libraries.length,
      playlists: playlists.length,
      songs: totalSongs,
    });

    return {
      success: true,
      libraries: libraries.length,
      playlists: playlists.length,
      songs: totalSongs,
    };
  } catch (error) {
    logger.error("[MetadataSync] Sync failed", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if sync is needed based on last sync time and interval
 */
export function shouldSync(): boolean {
  const settings = getSyncSettings();
  if (!settings.autoSync || settings.syncInterval === 0) {
    return false;
  }

  const lastSync = getLastSyncTime();
  if (!lastSync) return true; // Never synced before

  const timeSinceLastSync = Date.now() - lastSync;
  return timeSinceLastSync >= settings.syncInterval;
}

// Sync state
let syncIntervalId: NodeJS.Timeout | null = null;
let networkListenersAttached = false;
let isSyncing = false;

/**
 * Perform sync if conditions are met (debounced)
 * 
 * Note: Unlike manualSync(), this does NOT call notifySyncStatusChange().
 * Background auto-sync runs silently without UI feedback to avoid
 * distracting users with frequent status updates.
 */
async function performSyncIfNeeded(): Promise<void> {
  if (isSyncing) return;
  if (!navigator.onLine) return;
  if (!shouldSync()) return;

  isSyncing = true;
  try {
    await syncMetadata();
  } catch (error) {
    logger.error("[MetadataSync] Auto-sync failed", { error });
  } finally {
    isSyncing = false;
  }
}

// Event handlers
const handleOnline = () => {
  logger.info("[MetadataSync] Network online, triggering sync");
  performSyncIfNeeded();
};

/**
 * Start automatic sync service
 * - Listens for online events
 * - Runs periodic sync if enabled
 * - Performs initial sync on startup
 */
export function startAutoSync(): void {
  if (syncIntervalId) {
    logger.debug("[MetadataSync] Auto-sync already running");
    return;
  }

  logger.info("[MetadataSync] Starting auto-sync service");

  // Attach network listener
  if (!networkListenersAttached) {
    window.addEventListener("online", handleOnline);
    networkListenersAttached = true;
  }

  // Initial sync
  performSyncIfNeeded();

  // Periodic sync
  const settings = getSyncSettings();
  if (settings.autoSync && settings.syncInterval > 0) {
    syncIntervalId = setInterval(() => {
      performSyncIfNeeded();
    }, settings.syncInterval);
  }
}

/**
 * Stop automatic sync service
 */
export function stopAutoSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    logger.info("[MetadataSync] Auto-sync stopped");
  }

  if (networkListenersAttached) {
    window.removeEventListener("online", handleOnline);
    networkListenersAttached = false;
  }
  
  notifySyncStatusChange();
}

/**
 * Restart auto-sync with current settings
 */
export function restartAutoSync(): void {
  stopAutoSync();
  startAutoSync();
}

/**
 * Trigger manual sync (ignores shouldSync check)
 */
export async function manualSync(): Promise<SyncResult> {
  logger.info("[MetadataSync] Manual sync triggered");
  
  if (isSyncing) {
    return { success: false, error: "Sync already in progress" };
  }

  isSyncing = true;
  notifySyncStatusChange();
  try {
    return await syncMetadata();
  } finally {
    isSyncing = false;
    notifySyncStatusChange();
  }
}

/**
 * Get sync status information
 */
export interface SyncStatus {
  lastSyncTime: number | null;
  lastSyncTimeFormatted: string | null;
  isSyncing: boolean;
  autoSyncEnabled: boolean;
}

export function getSyncStatus(): SyncStatus {
  const lastSync = getLastSyncTime();
  const settings = getSyncSettings();
  return {
    lastSyncTime: lastSync,
    lastSyncTimeFormatted: lastSync ? new Date(lastSync).toLocaleString() : null,
    isSyncing,
    autoSyncEnabled: settings.autoSync,
  };
}
