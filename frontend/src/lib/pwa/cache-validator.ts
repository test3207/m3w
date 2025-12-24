/**
 * Cache Validator - Layer 2: Immediate Validation
 * 
 * Provides fast cache status checks with in-memory caching
 * Called before playback to ensure audio is available
 * Reduces database queries with 1-minute expiry
 */

import { db } from "@/lib/db/schema";
import { logger } from "@/lib/logger-client";
import { getCacheName } from "@/lib/pwa/cache-manager";
import { CACHE_VALIDATOR_EXPIRY } from "@/lib/storage/storage-constants";

interface CacheStatus {
  isCached: boolean;
  cacheSize?: number;
  checkedAt: number;
}

class CacheValidator {
  private cache = new Map<string, CacheStatus>();

  /**
   * Check if song is cached (with in-memory cache)
   * @param songId - Song ID
   * @param streamUrl - Stream URL
   * @returns Cache status
   */
  async isSongCached(songId: string, streamUrl?: string): Promise<boolean> {
    // Check in-memory cache first
    const cached = this.cache.get(songId);
    if (cached && Date.now() - cached.checkedAt < CACHE_VALIDATOR_EXPIRY) {
      return cached.isCached;
    }

    // Check Cache Storage API
    const status = await this.validateSongCache(songId, streamUrl);
    
    // Update in-memory cache
    this.cache.set(songId, status);

    return status.isCached;
  }

  /**
   * Validate song cache and update IndexedDB if needed
   * @param songId - Song ID
   * @param streamUrl - Stream URL
   * @returns Cache status
   */
  async validateSongCache(songId: string, streamUrl?: string): Promise<CacheStatus> {
    const checkedAt = Date.now();

    if (!streamUrl) {
      return { isCached: false, checkedAt };
    }

    try {
      const cacheName = getCacheName("audio");
      const cache = await caches.open(cacheName);
      const response = await cache.match(streamUrl);

      if (!response) {
        // Not cached
        await this.updateIndexedDB(songId, false, undefined);
        return { isCached: false, checkedAt };
      }

      // Get cache size
      const blob = await response.blob();
      const cacheSize = blob.size;

      // Update IndexedDB
      await this.updateIndexedDB(songId, true, cacheSize);

      return { isCached: true, cacheSize, checkedAt };
    } catch (error) {
      logger.error("[CacheValidator][validateSongCache]", "Failed to validate cache", error, { raw: { songId } });
      return { isCached: false, checkedAt };
    }
  }

  /**
   * Prevalidate multiple songs (for playlist preload)
   * @param songs - Array of {songId, streamUrl}
   * @returns Map of songId -> isCached
   */
  async prevalidateSongs(
    songs: Array<{ songId: string; streamUrl?: string }>
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // Process in parallel (max 10 at a time)
    const CHUNK_SIZE = 10;
    for (let i = 0; i < songs.length; i += CHUNK_SIZE) {
      const chunk = songs.slice(i, i + CHUNK_SIZE);
      
      await Promise.all(
        chunk.map(async ({ songId, streamUrl }) => {
          const isCached = await this.isSongCached(songId, streamUrl);
          results.set(songId, isCached);
        })
      );
    }

    return results;
  }

  /**
   * Clear in-memory cache
   */
  clearMemoryCache() {
    this.cache.clear();
    logger.debug("[CacheValidator][clearMemoryCache]", "Cache validator memory cleared");
  }

  /**
   * Remove specific song from memory cache
   */
  invalidateSong(songId: string) {
    this.cache.delete(songId);
  }

  /**
   * Update IndexedDB with cache status
   */
  private async updateIndexedDB(
    songId: string,
    isCached: boolean,
    cacheSize?: number
  ): Promise<void> {
    try {
      const song = await db.songs.get(songId);
      if (!song) return;

      // Only update if changed
      if (song.isCached !== isCached || song.cacheSize !== cacheSize) {
        await db.songs.update(songId, {
          isCached,
          cacheSize,
          lastCacheCheck: Date.now(),
        });

        logger.debug("[CacheValidator][updateIndexedDB]", "Cache status updated in IndexedDB", {
          raw: {
            songId,
            isCached,
            cacheSize,
          },
        });
      }
    } catch (error) {
      logger.error("[CacheValidator][updateIndexedDB]", "Failed to update IndexedDB", error, { raw: { songId } });
    }
  }
}

// Singleton instance
export const cacheValidator = new CacheValidator();
