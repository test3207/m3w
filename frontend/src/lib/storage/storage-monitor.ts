/**
 * Storage Monitor - Quota Monitoring Service
 * 
 * Monitors browser storage quota using navigator.storage.estimate()
 * Provides real-time usage statistics and warnings
 */

import { db } from "@/lib/db/schema";
import { logger } from "@/lib/logger-client";
import {
  AVG_AUDIO_SIZE,
  AVG_COVER_SIZE,
  AVG_METADATA_SIZE,
  CRITICAL_THRESHOLD,
  WARNING_THRESHOLD,
} from "./storage-constants";

export interface StorageUsage {
  /** Total quota in bytes */
  quota: number;
  /** Used storage in bytes */
  usage: number;
  /** Usage percentage (0-100) */
  usagePercent: number;
  /** Is persistent storage granted */
  isPersistent: boolean;
  /** Breakdown by category */
  breakdown: {
    audio: number;
    covers: number;
    metadata: number;
  };
}

export interface StorageWarning {
  level: "info" | "warning" | "critical";
  message: string;
  usagePercent: number;
}

class StorageMonitor {
  /**
   * Get current storage usage
   */
  async getStorageUsage(): Promise<StorageUsage> {
    try {
      // Get quota from Storage API
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;

      // Check persistent storage
      const isPersistent = await navigator.storage.persisted();

      // Get detailed breakdown
      const breakdown = await this.getDetailedBreakdown();

      return {
        quota,
        usage,
        usagePercent,
        isPersistent,
        breakdown,
      };
    } catch (error) {
      logger.error("Failed to get storage usage", { error });
      return {
        quota: 0,
        usage: 0,
        usagePercent: 0,
        isPersistent: false,
        breakdown: { audio: 0, covers: 0, metadata: 0 },
      };
    }
  }

  /**
   * Get detailed storage breakdown
   */
  async getDetailedBreakdown(): Promise<{
    audio: number;
    covers: number;
    metadata: number;
  }> {
    try {
      // Get all songs
      const songs = await db.songs.toArray();
      const cachedSongs = songs.filter(s => s.isCached);

      // Calculate audio cache size (only cached songs)
      const audioSize = cachedSongs.reduce((sum, song) => {
        // Use cacheSize if available, otherwise use constant estimate
        const size = song.cacheSize || AVG_AUDIO_SIZE;
        return sum + size;
      }, 0);

      // Estimate cover size (only cached songs, ~100KB per cover)
      const coverSize = cachedSongs.length * AVG_COVER_SIZE;

      // Estimate IndexedDB metadata size (all songs, ~10KB per song)
      // This includes song metadata, playlist links, etc.
      const metadataSize = songs.length * AVG_METADATA_SIZE;

      return {
        audio: audioSize,
        covers: coverSize,
        metadata: metadataSize,
      };
    } catch (error) {
      logger.error("Failed to get storage breakdown", { error });
      return { audio: 0, covers: 0, metadata: 0 };
    }
  }

  /**
   * Check if storage warning should be shown
   */
  async checkWarning(): Promise<StorageWarning | null> {
    const usage = await this.getStorageUsage();

    if (usage.usagePercent >= CRITICAL_THRESHOLD) {
      return {
        level: "critical",
        message: "Storage almost full! Consider cleaning up unused songs.",
        usagePercent: usage.usagePercent,
      };
    }

    if (usage.usagePercent >= WARNING_THRESHOLD) {
      return {
        level: "warning",
        message: "Storage running low. Clean up recommended.",
        usagePercent: usage.usagePercent,
      };
    }

    return null;
  }

  /**
   * Request persistent storage permission
   * @returns {Promise<'granted' | 'denied' | 'unsupported'>}
   */
  async requestPersistentStorage(): Promise<"granted" | "denied" | "unsupported"> {
    try {
      if (!navigator.storage || !navigator.storage.persist) {
        logger.warn("Persistent storage not supported");
        return "unsupported";
      }

      // Check current persisted status first
      const alreadyPersisted = await navigator.storage.persisted();
      logger.info("Current persisted status", { alreadyPersisted });

      // If already persisted, return granted immediately
      if (alreadyPersisted) {
        logger.info("Storage already persisted");
        return "granted";
      }

      const isPersisted = await navigator.storage.persist();
      logger.info("Persistent storage request result", { 
        isPersisted, 
        alreadyPersisted,
        userAgent: navigator.userAgent,
        isStandalone: window.matchMedia("(display-mode: standalone)").matches
      });
      
      return isPersisted ? "granted" : "denied";
    } catch (error) {
      logger.error("Failed to request persistent storage", { error });
      return "denied";
    }
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Get storage status color
   */
  getStatusColor(usagePercent: number): "success" | "warning" | "destructive" {
    if (usagePercent >= CRITICAL_THRESHOLD) return "destructive";
    if (usagePercent >= WARNING_THRESHOLD) return "warning";
    return "success";
  }

  /**
   * Estimate available space for new songs
   * @param avgSongSize - Average song size in bytes (default: from constants)
   */
  async estimateAvailableSongs(avgSongSize: number = AVG_AUDIO_SIZE): Promise<number> {
    const usage = await this.getStorageUsage();
    const availableBytes = usage.quota - usage.usage;
    return Math.floor(availableBytes / avgSongSize);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalSongs: number;
    cachedSongs: number;
    cachePercent: number;
    totalCacheSize: number;
  }> {
    try {
      const songs = await db.songs.toArray();
      const cachedSongs = songs.filter((s) => s.isCached);
      const totalCacheSize = cachedSongs.reduce((sum, s) => sum + (s.cacheSize || 0), 0);

      return {
        totalSongs: songs.length,
        cachedSongs: cachedSongs.length,
        cachePercent: songs.length > 0 ? (cachedSongs.length / songs.length) * 100 : 0,
        totalCacheSize,
      };
    } catch (error) {
      logger.error("Failed to get cache stats", { error });
      return {
        totalSongs: 0,
        cachedSongs: 0,
        cachePercent: 0,
        totalCacheSize: 0,
      };
    }
  }
}

// Singleton instance
export const storageMonitor = new StorageMonitor();
