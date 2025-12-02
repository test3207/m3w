/**
 * Background Sync Service
 * 
 * Unified sync service that handles:
 * 1. PUSH: Send dirty (locally modified) entities to backend
 * 2. PULL: Fetch latest server state (overwrites local via Server-Wins)
 * 3. ID Mapping: Handle local-only entities that need server-assigned IDs
 * 
 * Sync triggers:
 * - Periodic timer (every 5 minutes)
 * - Network comes online
 * - Page becomes visible (user switches back to app)
 * - Manual trigger
 */

import { db, getDirtyCount, markSynced, updateEntityId } from '../db/schema';
import type { OfflineLibrary, OfflinePlaylist } from '../db/schema';
import { logger } from '../logger-client';
import { syncMetadata } from './metadata-sync';
import { api } from '@/services';
import { toast } from '@/components/ui/use-toast';
import { I18n } from '@/locales/i18n';

// Sync interval: 5 minutes (aligned with metadata-sync)
const SYNC_INTERVAL = 5 * 60 * 1000;

export interface SyncResult {
  pushed: {
    libraries: number;
    playlists: number;
    songs: number;
    playlistSongs: number;
  };
  pulled: {
    libraries: number;
    playlists: number;
    songs: number;
    playlistSongs: number;
  };
  conflicts: number;
  errors: string[];
}

export class SyncService {
  private isSyncing = false;
  private syncInterval: number | null = null;
  private onlineHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  /**
   * Start background sync service
   */
  start() {
    if (this.syncInterval) {
      logger.info('Sync service already running');
      return;
    }

    // Periodic sync (every 5 minutes)
    this.syncInterval = window.setInterval(() => {
      this.syncIfNeeded();
    }, SYNC_INTERVAL);

    // Sync when network comes online
    this.onlineHandler = () => {
      logger.info('Network online, triggering sync');
      this.syncIfNeeded();
    };
    window.addEventListener('online', this.onlineHandler);

    // Sync when page becomes visible (user switches back to app)
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        logger.info('Page visible, checking for sync');
        this.syncIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    logger.info('Background sync service started');

    // Initial sync on start
    this.syncIfNeeded();
  }

  /**
   * Stop background sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    logger.info('Background sync service stopped');
  }

  /**
   * Check conditions and sync if appropriate
   */
  private async syncIfNeeded(): Promise<void> {
    // Skip if already syncing
    if (this.isSyncing) return;

    // Skip if offline
    if (!navigator.onLine) return;

    // Skip if guest user
    if (this.isGuestUser()) return;

    await this.sync();
  }

  /**
   * Check if current user is a guest
   */
  private isGuestUser(): boolean {
    const authStore = localStorage.getItem('auth-storage');
    if (authStore) {
      try {
        const { state } = JSON.parse(authStore);
        return state?.isGuest === true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Perform full sync (push then pull)
   */
  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      pushed: { libraries: 0, playlists: 0, songs: 0, playlistSongs: 0 },
      pulled: { libraries: 0, playlists: 0, songs: 0, playlistSongs: 0 },
      conflicts: 0,
      errors: [],
    };

    if (this.isSyncing) {
      logger.info('Sync already in progress, skipping');
      return result;
    }

    if (!navigator.onLine) {
      logger.info('Offline, skipping sync');
      return result;
    }

    this.isSyncing = true;

    try {
      const dirtyCount = await getDirtyCount();
      logger.info(`Starting sync (${dirtyCount} dirty entities)`);

      // Phase 1: PUSH - Send local changes to server
      if (dirtyCount > 0) {
        const pushResult = await this.pushDirtyEntities();
        result.pushed = pushResult.pushed;
        result.conflicts = pushResult.conflicts;
        result.errors.push(...pushResult.errors);
      }

      // Phase 2: PULL - Fetch server state (Server-Wins overwrites local)
      const pullResult = await syncMetadata();
      if (pullResult.success) {
        result.pulled = {
          libraries: pullResult.libraries || 0,
          playlists: pullResult.playlists || 0,
          songs: pullResult.songs || 0,
          playlistSongs: pullResult.playlistSongs || 0,
        };
      } else if (pullResult.error) {
        result.errors.push(pullResult.error);
      }

      // Notify user if there were conflicts
      if (result.conflicts > 0) {
        toast({
          title: I18n.sync.conflictsResolved,
          description: `${result.conflicts} ${I18n.sync.serverWins}`,
          variant: 'default',
        });
      }

      logger.info('Sync completed', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Sync failed', { error });
      result.errors.push(errorMessage);
      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push dirty entities to backend
   */
  private async pushDirtyEntities(): Promise<{
    pushed: SyncResult['pushed'];
    conflicts: number;
    errors: string[];
  }> {
    const result = {
      pushed: { libraries: 0, playlists: 0, songs: 0, playlistSongs: 0 },
      conflicts: 0,
      errors: [] as string[],
    };

    // Get all dirty entities
    const dirtyLibraries = await db.libraries.where('_isDirty').equals(1).toArray();
    const dirtyPlaylists = await db.playlists.where('_isDirty').equals(1).toArray();
    const dirtySongs = await db.songs.where('_isDirty').equals(1).toArray();
    const dirtyPlaylistSongs = await db.playlistSongs.where('_isDirty').equals(1).toArray();

    logger.info('Pushing dirty entities', {
      libraries: dirtyLibraries.length,
      playlists: dirtyPlaylists.length,
      songs: dirtySongs.length,
      playlistSongs: dirtyPlaylistSongs.length,
    });

    // Push libraries (order matters: libraries first, then playlists, then songs)
    for (const lib of dirtyLibraries) {
      try {
        await this.pushLibrary(lib);
        result.pushed.libraries++;
      } catch (error) {
        logger.error('Failed to push library', { id: lib.id, error });
        result.errors.push(`Library ${lib.name}: ${error instanceof Error ? error.message : 'Failed'}`);
      }
    }

    // Push playlists
    for (const pl of dirtyPlaylists) {
      try {
        await this.pushPlaylist(pl);
        result.pushed.playlists++;
      } catch (error) {
        logger.error('Failed to push playlist', { id: pl.id, error });
        result.errors.push(`Playlist ${pl.name}: ${error instanceof Error ? error.message : 'Failed'}`);
      }
    }

    // Note: Songs are typically created via upload flow, not offline
    // For now, just clear dirty flags on songs (server state will overwrite)
    for (const song of dirtySongs) {
      if (song._isDeleted) {
        await db.songs.delete(song.id);
      } else {
        await db.songs.put(markSynced(song));
      }
      result.pushed.songs++;
    }

    // Push playlist song relationships
    for (const ps of dirtyPlaylistSongs) {
      if (ps._isDeleted) {
        await db.playlistSongs.delete(ps.id);
      } else {
        await db.playlistSongs.put(markSynced(ps));
      }
      result.pushed.playlistSongs++;
    }

    return result;
  }

  /**
   * Push a single library to backend
   */
  private async pushLibrary(library: OfflineLibrary): Promise<void> {
    if (library._isDeleted) {
      // Delete from server
      if (!library._isLocalOnly) {
        try {
          await api.main.libraries.delete(library.id);
        } catch (error) {
          // 404 is okay - already deleted on server
          if (!(error instanceof Error && error.message.includes('404'))) {
            throw error;
          }
        }
      }
      // Remove from local DB
      await db.libraries.delete(library.id);
      return;
    }

    if (library._isLocalOnly) {
      // Create new library on server
      const created = await api.main.libraries.create({
        name: library.name,
        description: library.description || undefined,
      });
      
      // Update local ID to match server ID
      if (created.id !== library.id) {
        await updateEntityId('libraries', library.id, created.id);
        logger.info('Library ID mapped', { local: library.id, server: created.id });
      } else {
        await db.libraries.put(markSynced(library));
      }
    } else {
      // Update existing library on server
      try {
        await api.main.libraries.update(library.id, {
          name: library.name,
          description: library.description || undefined,
        });
        await db.libraries.put(markSynced(library));
      } catch (error) {
        // 404 means server doesn't have it - treat as conflict (server wins)
        if (error instanceof Error && error.message.includes('404')) {
          logger.warn('Library not found on server, will be recreated on pull', { id: library.id });
          await db.libraries.delete(library.id);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Push a single playlist to backend
   */
  private async pushPlaylist(playlist: OfflinePlaylist): Promise<void> {
    if (playlist._isDeleted) {
      // Delete from server
      if (!playlist._isLocalOnly) {
        try {
          await api.main.playlists.delete(playlist.id);
        } catch (error) {
          // 404 is okay - already deleted on server
          if (!(error instanceof Error && error.message.includes('404'))) {
            throw error;
          }
        }
      }
      // Remove from local DB
      await db.playlists.delete(playlist.id);
      // Also remove playlist songs
      await db.playlistSongs.where('playlistId').equals(playlist.id).delete();
      return;
    }

    if (playlist._isLocalOnly) {
      // Create new playlist on server
      const created = await api.main.playlists.create({
        name: playlist.name,
        description: playlist.description || undefined,
      });
      
      // Update local ID to match server ID
      if (created.id !== playlist.id) {
        await updateEntityId('playlists', playlist.id, created.id);
        logger.info('Playlist ID mapped', { local: playlist.id, server: created.id });
      } else {
        await db.playlists.put(markSynced(playlist));
      }
    } else {
      // Update existing playlist on server
      try {
        await api.main.playlists.update(playlist.id, {
          name: playlist.name,
          description: playlist.description || undefined,
        });
        await db.playlists.put(markSynced(playlist));
      } catch (error) {
        // 404 means server doesn't have it - treat as conflict (server wins)
        if (error instanceof Error && error.message.includes('404')) {
          logger.warn('Playlist not found on server, will be recreated on pull', { id: playlist.id });
          await db.playlists.delete(playlist.id);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Get count of dirty entities waiting to sync
   */
  async getQueueSize(): Promise<number> {
    return await getDirtyCount();
  }

  /**
   * Check if sync is currently in progress
   */
  get isSyncInProgress(): boolean {
    return this.isSyncing;
  }
}

// Singleton instance
export const syncService = new SyncService();
