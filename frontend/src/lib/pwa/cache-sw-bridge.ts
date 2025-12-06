/**
 * Cache SW Bridge - Layer 3: Service Worker Communication
 * 
 * Listens for cache operation messages from Service Worker
 * Updates IndexedDB immediately when SW adds/removes cache
 * Provides real-time synchronization
 */

import { db } from "@/lib/db/schema";
import { logger } from "@/lib/logger-client";
import { cacheValidator } from "./cache-validator";

export interface CacheMessage {
  type: "CACHE_ADDED" | "CACHE_DELETED" | "CACHE_ERROR";
  songId: string;
  streamUrl: string;
  cacheSize?: number;
  error?: string;
}

class CacheSWBridge {
  private isInitialized = false;
  private listeners: Array<(message: CacheMessage) => void> = [];

  /**
   * Initialize Service Worker message listener
   */
  init() {
    if (this.isInitialized) {
      logger.warn("Cache SW bridge already initialized");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      logger.warn("Service Worker not supported");
      return;
    }

    // Listen for messages from Service Worker
    navigator.serviceWorker.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    this.isInitialized = true;
    logger.info("Cache SW bridge initialized");
  }

  /**
   * Handle message from Service Worker
   */
  private async handleMessage(data: unknown) {
    if (!this.isCacheMessage(data)) return;

    logger.debug("Cache message received from SW", data);

    // Notify listeners
    this.listeners.forEach((listener) => listener(data));

    // Update IndexedDB based on message type
    switch (data.type) {
      case "CACHE_ADDED":
        await this.handleCacheAdded(data);
        break;
      case "CACHE_DELETED":
        await this.handleCacheDeleted(data);
        break;
      case "CACHE_ERROR":
        logger.error("Cache error from SW", { songId: data.songId, error: data.error });
        break;
    }
  }

  /**
   * Type guard for cache messages
   */
  private isCacheMessage(data: unknown): data is CacheMessage {
    return (
      typeof data === "object" &&
      data !== null &&
      "type" in data &&
      "songId" in data &&
      "streamUrl" in data &&
      (data.type === "CACHE_ADDED" || data.type === "CACHE_DELETED" || data.type === "CACHE_ERROR")
    );
  }

  /**
   * Handle CACHE_ADDED message
   */
  private async handleCacheAdded(message: CacheMessage) {
    try {
      const song = await db.songs.get(message.songId);
      if (!song) {
        logger.warn("Song not found in IndexedDB", { songId: message.songId });
        return;
      }

      // Update cache status
      await db.songs.update(message.songId, {
        isCached: true,
        cacheSize: message.cacheSize,
        lastCacheCheck: Date.now(),
      });

      // Invalidate memory cache in validator
      cacheValidator.invalidateSong(message.songId);

      logger.info("Cache added", {
        songId: message.songId,
        cacheSize: message.cacheSize,
      });
    } catch (error) {
      logger.error("Failed to handle CACHE_ADDED", { message, error });
    }
  }

  /**
   * Handle CACHE_DELETED message
   */
  private async handleCacheDeleted(message: CacheMessage) {
    try {
      const song = await db.songs.get(message.songId);
      if (!song) {
        logger.warn("Song not found in IndexedDB", { songId: message.songId });
        return;
      }

      // Update cache status
      await db.songs.update(message.songId, {
        isCached: false,
        cacheSize: undefined,
        lastCacheCheck: Date.now(),
      });

      // Invalidate memory cache in validator
      cacheValidator.invalidateSong(message.songId);

      logger.info("Cache deleted", { songId: message.songId });
    } catch (error) {
      logger.error("Failed to handle CACHE_DELETED", { message, error });
    }
  }

  /**
   * Subscribe to cache messages
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  subscribe(listener: (message: CacheMessage) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Send message to Service Worker
   * @param message - Message to send
   */
  async sendToSW(message: unknown): Promise<void> {
    if (!navigator.serviceWorker.controller) {
      logger.warn("No active Service Worker controller");
      return;
    }

    navigator.serviceWorker.controller.postMessage(message);
  }
}

// Singleton instance
export const cacheSWBridge = new CacheSWBridge();

// Auto-initialize on import (only in browser context)
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  cacheSWBridge.init();
}
