/**
 * Cache Sync Service - Layer 1: Background Synchronization
 * 
 * Runs periodic scans every 5 minutes to check cache status for all songs
 * Updates IndexedDB with current cache state (isCached, cacheSize)
 * 
 * This is the baseline sync mechanism that catches any discrepancies
 * between Cache Storage API and IndexedDB metadata.
 */

import { db } from "@/lib/db/schema";
import { logger } from "@/lib/logger-client";
import { getCacheName } from "@/lib/pwa/cache-manager";
import { CACHE_SYNC_INTERVAL, CACHE_SYNC_BATCH_SIZE } from "@/lib/storage/storage-constants";

interface SyncStats {
  totalChecked: number;
  cacheMismatches: number;
  errors: number;
  duration: number;
}

class CacheSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastSyncTime = 0;

  /**
   * Start background sync service
   */
  start() {
    if (this.intervalId) {
      logger.warn("[CacheSyncService][start]", "Cache sync service already running");
      return;
    }

    logger.info("[CacheSyncService][start]", "Starting cache sync service", { raw: { interval: CACHE_SYNC_INTERVAL } });
    
    // Run immediately on start
    this.runSync().catch((error) => {
      logger.error("[CacheSyncService][start]", "Initial cache sync failed", error);
    });

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.runSync().catch((error) => {
        logger.error("[CacheSyncService][start]", "Scheduled cache sync failed", error);
      });
    }, CACHE_SYNC_INTERVAL);
  }

  /**
   * Stop background sync service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("[CacheSyncService][stop]", "Cache sync service stopped");
    }
  }

  /**
   * Force immediate sync (for manual refresh)
   */
  async forceSync(): Promise<SyncStats> {
    return this.runSync();
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * Check if sync is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Main sync logic
   */
  private async runSync(): Promise<SyncStats> {
    if (this.isRunning) {
      logger.warn("[CacheSyncService][runSync]", "Cache sync already in progress, skipping");
      throw new Error("Sync already in progress");
    }

    this.isRunning = true;
    const startTime = Date.now();
    const stats: SyncStats = {
      totalChecked: 0,
      cacheMismatches: 0,
      errors: 0,
      duration: 0,
    };

    try {
      logger.info("[CacheSyncService][runSync]", "Cache sync started");

      // Get all songs from IndexedDB
      const songs = await db.songs.toArray();
      stats.totalChecked = songs.length;

      if (songs.length === 0) {
        logger.info("[CacheSyncService][runSync]", "No songs to sync");
        return stats;
      }

      // Open audio cache
      const cache = await caches.open(getCacheName("audio"));

      // Process in batches
      for (let i = 0; i < songs.length; i += CACHE_SYNC_BATCH_SIZE) {
        const batch = songs.slice(i, i + CACHE_SYNC_BATCH_SIZE);
        
        await Promise.all(
          batch.map(async (song) => {
            try {
              // Check cache status
              const isCached = await this.checkSongCache(cache, song.id, song.streamUrl);
              const cacheSize = isCached ? await this.getCacheSize(cache, song.streamUrl) : undefined;

              // Compare with IndexedDB
              if (song.isCached !== isCached || song.cacheSize !== cacheSize) {
                stats.cacheMismatches++;
                
                // Update IndexedDB
                await db.songs.update(song.id, {
                  isCached,
                  cacheSize,
                  lastCacheCheck: Date.now(),
                });

                logger.debug("[CacheSyncService][runSync]", "Cache mismatch fixed", {
                  raw: {
                    songId: song.id,
                    wasCached: song.isCached,
                    nowCached: isCached,
                  },
                });
              } else {
                // Just update lastCacheCheck
                await db.songs.update(song.id, {
                  lastCacheCheck: Date.now(),
                });
              }
            } catch (error) {
              stats.errors++;
              logger.error("[CacheSyncService][runSync]", "Failed to sync song cache", error, { raw: { songId: song.id } });
            }
          })
        );
      }

      this.lastSyncTime = Date.now();
      stats.duration = Date.now() - startTime;

      logger.info("[CacheSyncService][runSync]", "Cache sync completed", { raw: stats });
      
      return stats;
    } catch (error) {
      logger.error("[CacheSyncService][runSync]", "Cache sync failed", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if a song is cached
   */
  private async checkSongCache(cache: Cache, songId: string, streamUrl?: string): Promise<boolean> {
    if (!streamUrl) return false;

    try {
      const response = await cache.match(streamUrl);
      return response !== undefined;
    } catch (error) {
      logger.error("[CacheSyncService][checkSongCache]", "Failed to check cache", error, { raw: { songId } });
      return false;
    }
  }

  /**
   * Get cached file size
   */
  private async getCacheSize(cache: Cache, streamUrl?: string): Promise<number | undefined> {
    if (!streamUrl) return undefined;

    try {
      const response = await cache.match(streamUrl);
      if (!response) return undefined;

      const blob = await response.blob();
      return blob.size;
    } catch (error) {
      logger.error("[CacheSyncService][getCacheSize]", "Failed to get cache size", error, { raw: { streamUrl } });
      return undefined;
    }
  }
}

// Singleton instance
export const cacheSyncService = new CacheSyncService();

// Auto-start on import (only in browser context)
if (typeof window !== "undefined" && "caches" in window) {
  cacheSyncService.start();
}
