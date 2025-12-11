/**
 * Download Manager
 * 
 * Background download queue for caching library songs.
 * - Silent downloads (no progress UI)
 * - 3 concurrent downloads
 * - Respects auto-download setting
 */

import { db } from "../db/schema";
import { cacheSong, isSongCached, isAudioCacheAvailable } from "./audio-cache";
import { canAutoDownload } from "./cache-policy";
import { logger } from "../logger-client";
import { useAuthStore } from "@/stores/authStore";
import { GUEST_USER_ID } from "@/lib/constants/guest";
import { eventBus, EVENTS, type SongCachedPayload } from "../events";

// ============================================================
// Configuration
// ============================================================

const MAX_CONCURRENT_DOWNLOADS = 3;
const DOWNLOAD_RETRY_DELAY = 5000; // 5 seconds
const MAX_RETRIES = 3;

// ============================================================
// Download Queue State
// ============================================================

interface DownloadTask {
  songId: string;
  libraryId: string;
  retries: number;
}

let downloadQueue: DownloadTask[] = [];
let activeDownloads = 0;
let isProcessing = false;

// ============================================================
// Public API
// ============================================================

/**
 * Queue all songs from a library for download
 * @param force - If true, bypass auto-download check (for manual user-initiated downloads)
 */
export async function queueLibraryDownload(
  libraryId: string,
  force: boolean = false
): Promise<number> {
  // Check if caching is available (requires Cache API and sufficient quota)
  const cacheAvailable = await isAudioCacheAvailable();
  if (!cacheAvailable) {
    logger.debug("Audio cache not available: no storage quota");
    return 0;
  }

  // Check auto-download setting (skip if force=true, i.e., user manually triggered download)
  if (!force) {
    const canDownload = await canAutoDownload();
    if (!canDownload) {
      logger.debug("Auto-download not allowed based on setting/network");
      return 0;
    }
  }

  // Get all songs in library that aren't cached yet
  const songs = await db.songs
    .where("libraryId")
    .equals(libraryId)
    .toArray();

  let queued = 0;
  for (const song of songs) {
    const cached = await isSongCached(song.id);
    if (!cached) {
      addToQueue({ songId: song.id, libraryId, retries: 0 });
      queued++;
    }
  }

  logger.info(`Queued ${queued} songs from library ${libraryId} for download`);

  // Start processing
  processQueue();

  return queued;
}

/**
 * Queue a single song for download
 */
export function queueSongDownload(songId: string, libraryId: string): void {
  addToQueue({ songId, libraryId, retries: 0 });
  processQueue();
}

/**
 * Cancel all pending downloads for a library
 */
export function cancelLibraryDownloads(libraryId: string): number {
  const before = downloadQueue.length;
  downloadQueue = downloadQueue.filter(task => task.libraryId !== libraryId);
  const cancelled = before - downloadQueue.length;
  logger.info(`Cancelled ${cancelled} downloads for library ${libraryId}`);
  return cancelled;
}

/**
 * Cancel all pending downloads
 */
export function cancelAllDownloads(): void {
  downloadQueue = [];
  logger.info("Cancelled all pending downloads");
}

/**
 * Get current queue status
 */
export function getQueueStatus(): {
  pending: number;
  active: number;
  isProcessing: boolean;
  } {
  return {
    pending: downloadQueue.length,
    active: activeDownloads,
    isProcessing,
  };
}

/**
 * Trigger auto-download for all libraries
 * Called on app startup to trigger auto-download based on user settings
 */
export async function triggerAutoDownload(): Promise<void> {
  try {
    // Check if we can auto-download
    const canDownload = await canAutoDownload();
    if (!canDownload) {
      logger.debug("Auto-download not allowed based on setting/network");
      return;
    }

    // Get current user's libraries
    const { user, isGuest } = useAuthStore.getState();
    const userId = isGuest ? GUEST_USER_ID : user?.id;

    if (!userId) {
      logger.debug("No user ID, skipping auto-download");
      return;
    }

    // Get user's libraries from IndexedDB
    const userLibraries = await db.libraries
      .filter(lib => lib.userId === userId)
      .toArray();

    logger.info(`Auto-download triggered for ${userLibraries.length} libraries`);

    for (const library of userLibraries) {
      // Use force=false since we already checked canAutoDownload
      await queueLibraryDownload(library.id, false);
    }
  } catch (error) {
    logger.error("Auto-download failed", error);
  }
}

// ============================================================
// Internal Queue Processing
// ============================================================

function addToQueue(task: DownloadTask): void {
  // Avoid duplicates
  const exists = downloadQueue.some(t => t.songId === task.songId);
  if (!exists) {
    downloadQueue.push(task);
  }
}

async function processQueue(): Promise<void> {
  if (isProcessing) {
    logger.debug("processQueue: already processing, skipping");
    return;
  }
  isProcessing = true;
  logger.debug(`processQueue: starting, queue length=${downloadQueue.length}`);

  try {
    // Check if caching is available
    const cacheAvailable = await isAudioCacheAvailable();
    if (!cacheAvailable) {
      logger.debug("processQueue: cache not available, clearing queue");
      downloadQueue = [];
      return;
    }

    while (downloadQueue.length > 0 && activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
      // Check if we can still download (auto-download may have been disabled or network changed)
      const canDownload = await canAutoDownload();
      if (!canDownload) {
        logger.debug("processQueue: pausing downloads, auto-download not allowed");
        break;
      }

      const task = downloadQueue.shift();
      if (!task) break;

      logger.debug(`processQueue: starting download for song ${task.songId}`);
      activeDownloads++;
      // Don't await - let it run in parallel
      processTask(task).finally(() => {
        activeDownloads--;
        logger.debug(`processQueue: finished task, active=${activeDownloads}, pending=${downloadQueue.length}`);
        // Schedule next batch after task completes (avoid race conditions)
        scheduleNextBatch();
      });
    }
  } finally {
    isProcessing = false;
    logger.debug(`processQueue: finished loop, active=${activeDownloads}, pending=${downloadQueue.length}`);
  }
}

// Debounced trigger for next batch to avoid race conditions
let nextBatchScheduled = false;
function scheduleNextBatch(): void {
  if (nextBatchScheduled) return;
  if (downloadQueue.length === 0) return;

  nextBatchScheduled = true;
  // Use queueMicrotask to batch multiple completions into one processQueue call
  queueMicrotask(() => {
    nextBatchScheduled = false;
    processQueue();
  });
}

async function processTask(task: DownloadTask): Promise<void> {
  try {
    // Check if song still exists in IndexedDB (may have been deleted by sync)
    const songExists = await db.songs.get(task.songId);
    if (!songExists) {
      logger.debug(`Song ${task.songId} no longer exists in IndexedDB, skipping`);
      return;
    }

    // Check if already cached
    const cached = await isSongCached(task.songId);
    if (cached) {
      logger.debug(`Song ${task.songId} already cached, skipping`);
      return;
    }

    // Download silently (no progress callback)
    await cacheSong(task.songId);

    // Update song record
    await db.songs.update(task.songId, {
      isCached: true,
      lastCacheCheck: Date.now(),
    });

    logger.debug(`Successfully cached song ${task.songId}`);

    // Notify UI to refresh cache status (with libraryId for filtering)
    eventBus.emit<SongCachedPayload>(EVENTS.SONG_CACHED, { libraryId: task.libraryId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to cache song ${task.songId}: ${errorMessage}`);

    // Don't retry for permanent failures (404, not found, not available)
    if (errorMessage.includes("not available") ||
      errorMessage.includes("not found") ||
      errorMessage.includes("404")) {
      logger.debug(`Permanent failure for song ${task.songId}, not retrying`);
      return;
    }

    // Retry logic for transient failures
    if (task.retries < MAX_RETRIES) {
      task.retries++;
      setTimeout(() => {
        addToQueue(task);
        processQueue();
      }, DOWNLOAD_RETRY_DELAY * task.retries);
    } else {
      logger.warn(`Max retries reached for song ${task.songId}`);
    }
  }
}

// ============================================================
// Cache Statistics
// ============================================================

/**
 * Get cache statistics for a library
 * Accepts songs array directly to avoid IndexedDB dependency (works for Auth mode)
 * 
 * @param songs - Array of songs with id property
 * @returns Cache statistics: total, cached, percentage
 */
export async function getLibraryCacheStats(songs: { id: string }[]): Promise<{
  total: number;
  cached: number;
  percentage: number;
}> {
  const total = songs.length;
  let cached = 0;

  for (const song of songs) {
    if (await isSongCached(song.id)) {
      cached++;
    }
  }

  return {
    total,
    cached,
    percentage: total > 0 ? Math.round((cached / total) * 100) : 0,
  };
}

/**
 * Get overall cache statistics across all songs for the current user
 */
export async function getTotalCacheStats(): Promise<{
  total: number;
  cached: number;
  percentage: number;
}> {
  // Get current user's libraries
  const { user, isGuest } = useAuthStore.getState();
  const userId = isGuest ? GUEST_USER_ID : user?.id;

  if (!userId) {
    return { total: 0, cached: 0, percentage: 0 };
  }

  // Get user's library IDs
  const userLibraries = await db.libraries
    .filter(lib => lib.userId === userId)
    .toArray();
  const userLibraryIds = new Set(userLibraries.map(lib => lib.id));

  // Get songs only from user's libraries
  const songs = await db.songs
    .filter(song => userLibraryIds.has(song.libraryId))
    .toArray();

  const total = songs.length;
  let cached = 0;

  for (const song of songs) {
    if (await isSongCached(song.id)) {
      cached++;
    }
  }

  return {
    total,
    cached,
    percentage: total > 0 ? Math.round((cached / total) * 100) : 0,
  };
}
