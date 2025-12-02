/**
 * Background Sync Service
 * 
 * State-based sync: Pushes dirty entities to backend, then pulls server state.
 * Replaces the old operation-replay queue with a simpler dirty-tracking approach.
 * 
 * TODO (Phase 3): Implement full push-then-pull sync logic
 */

import { db, getDirtyCount, markSynced } from '../db/schema';
import { logger } from '../logger-client';
import { syncMetadata } from './metadata-sync';

export class SyncService {
  private isSyncing = false;
  private syncInterval: number | null = null;

  /**
   * Start background sync (checks every 30 seconds)
   */
  start() {
    if (this.syncInterval) {
      return;
    }

    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.sync();
      }
    }, 30000); // Check every 30 seconds

    // Also sync when coming back online
    window.addEventListener('online', () => {
      this.sync();
    });

    logger.info('Background sync service started');
  }

  /**
   * Stop background sync
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Manually trigger sync
   */
  async sync(): Promise<void> {
    // Check if user is guest
    const authStore = localStorage.getItem('auth-storage');
    if (authStore) {
      try {
        const { state } = JSON.parse(authStore);
        if (state?.isGuest) {
          return; // Do not sync in guest mode
        }
      } catch {
        // Ignore parse error
      }
    }

    if (this.isSyncing || !navigator.onLine) {
      return;
    }

    this.isSyncing = true;

    try {
      const dirtyCount = await getDirtyCount();

      if (dirtyCount === 0) {
        logger.info('No dirty entities to sync');
        // Still pull latest data from server
        await syncMetadata();
        return;
      }

      logger.info(`Syncing ${dirtyCount} dirty entities...`);

      // Phase 1: PUSH - Send dirty entities to server
      await this.pushDirtyEntities();

      // Phase 2: PULL - Get latest data from server (overwrites local)
      await syncMetadata();

      logger.info('Sync completed');
    } catch (error) {
      logger.error('Sync failed', { error });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push dirty entities to backend
   * TODO (Phase 3): Implement full push logic with conflict handling
   */
  private async pushDirtyEntities(): Promise<void> {
    // Get all dirty entities
    const dirtyLibraries = await db.libraries.where('_isDirty').equals(1).toArray();
    const dirtyPlaylists = await db.playlists.where('_isDirty').equals(1).toArray();
    const dirtySongs = await db.songs.where('_isDirty').equals(1).toArray();
    const dirtyPlaylistSongs = await db.playlistSongs.where('_isDirty').equals(1).toArray();

    logger.info('Dirty entities found', {
      libraries: dirtyLibraries.length,
      playlists: dirtyPlaylists.length,
      songs: dirtySongs.length,
      playlistSongs: dirtyPlaylistSongs.length,
    });

    // TODO (Phase 2/3): Implement actual push to backend
    // For now, just clear the dirty flag since metadata sync will overwrite
    // This is a temporary solution until backend /api/sync/push is implemented

    // Clear dirty flags (server data will overwrite via syncMetadata)
    for (const lib of dirtyLibraries) {
      if (lib._isDeleted) {
        // Hard delete locally (will be recreated if still exists on server)
        await db.libraries.delete(lib.id);
      } else {
        await db.libraries.put(markSynced(lib));
      }
    }

    for (const pl of dirtyPlaylists) {
      if (pl._isDeleted) {
        await db.playlists.delete(pl.id);
      } else {
        await db.playlists.put(markSynced(pl));
      }
    }

    for (const song of dirtySongs) {
      if (song._isDeleted) {
        await db.songs.delete(song.id);
      } else {
        await db.songs.put(markSynced(song));
      }
    }

    for (const ps of dirtyPlaylistSongs) {
      if (ps._isDeleted) {
        await db.playlistSongs.delete(ps.id);
      } else {
        await db.playlistSongs.put(markSynced(ps));
      }
    }

    logger.info('Dirty flags cleared, waiting for server sync');
  }

  /**
   * Get count of dirty entities waiting to sync
   */
  async getQueueSize(): Promise<number> {
    return await getDirtyCount();
  }
}

// Singleton instance
export const syncService = new SyncService();
