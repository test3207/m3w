/**
 * Background Sync Service
 * Syncs offline changes to backend when connection is restored
 */

import { db } from '../db/schema';
import type { SyncQueueItem } from '../db/schema';
import { logger } from '../logger-client';

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
    if (this.isSyncing || !navigator.onLine) {
      return;
    }

    this.isSyncing = true;

    try {
      const queue = await db.syncQueue.toArray();

      if (queue.length === 0) {
        logger.info('No pending sync items');
        return;
      }

      logger.info(`Syncing ${queue.length} items...`);

      // Process queue items one by one
      for (const item of queue) {
        try {
          await this.syncItem(item);
          await db.syncQueue.delete(item.id!);
          logger.info('Synced item', { item });
        } catch (error) {
          logger.error('Failed to sync item', { item, error });

          // Increment retry count
          await db.syncQueue.update(item.id!, {
            retryCount: item.retryCount + 1,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          // Give up after 3 retries
          if (item.retryCount >= 3) {
            logger.error('Max retries reached, removing from queue', { item });
            await db.syncQueue.delete(item.id!);
          }
        }
      }

      logger.info('Sync completed');
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single item to backend
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const { entityType, entityId, operation, data } = item;

    let url: string;
    let method: string;
    let body: unknown | undefined;

    switch (operation) {
      case 'create':
        url = `${backendUrl}/api/${entityType}s`;
        method = 'POST';
        body = data;
        break;

      case 'update':
        url = `${backendUrl}/api/${entityType}s/${entityId}`;
        method = 'PATCH';
        body = data;
        break;

      case 'delete':
        url = `${backendUrl}/api/${entityType}s/${entityId}`;
        method = 'DELETE';
        body = undefined;
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || response.statusText);
    }

    // Update local data with synced status
    const result = await response.json();

    if (operation !== 'delete' && result.data) {
      switch (entityType) {
        case 'library':
          await db.libraries.update(entityId, {
            ...result.data,
            _syncStatus: 'synced',
            _lastSyncedAt: new Date(),
          });
          break;

        case 'playlist':
          await db.playlists.update(entityId, {
            ...result.data,
            _syncStatus: 'synced',
            _lastSyncedAt: new Date(),
          });
          break;

        case 'song':
          await db.songs.update(entityId, {
            ...result.data,
            _syncStatus: 'synced',
            _lastSyncedAt: new Date(),
          });
          break;
      }
    }
  }

  /**
   * Get current sync queue size
   */
  async getQueueSize(): Promise<number> {
    return await db.syncQueue.count();
  }
}

// Singleton instance
export const syncService = new SyncService();
