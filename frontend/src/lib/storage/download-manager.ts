/**
 * Download Manager
 * 
 * Background download queue for caching library songs.
 * - Silent downloads (no progress UI)
 * - 3 concurrent downloads
 * - Respects download timing policy
 * - Integrates with cache-policy for decision making
 */

import { db } from '../db/schema';
import { cacheSong, isSongCached, isAudioCacheAvailable } from './audio-cache';
import { canDownloadNow, shouldCacheLibrary, type CachePolicyContext } from './cache-policy';
import { logger } from '../logger-client';

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
 */
export async function queueLibraryDownload(
  libraryId: string,
  context: CachePolicyContext
): Promise<number> {
  // Check if caching is available first (PWA + persistent storage)
  const cacheAvailable = await isAudioCacheAvailable();
  if (!cacheAvailable) {
    logger.debug('Audio cache not available (not PWA or storage not persisted)');
    return 0;
  }

  // Check policy
  const shouldCache = await shouldCacheLibrary(libraryId, context);
  if (!shouldCache) {
    logger.debug(`Library ${libraryId} not configured for caching`);
    return 0;
  }

  // Get all songs in library that aren't cached yet
  const songs = await db.songs
    .where('libraryId')
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
  logger.info('Cancelled all pending downloads');
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
 * Trigger download for all libraries that should be cached
 * Called after sync completes
 */
export async function triggerAutoCacheAfterSync(
  libraries: Array<{ id: string }>,
  context: CachePolicyContext
): Promise<void> {
  // Check if we can download now
  const canDownload = await canDownloadNow();
  if (!canDownload) {
    logger.debug('Download not allowed based on timing policy');
    return;
  }

  for (const library of libraries) {
    await queueLibraryDownload(library.id, context);
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
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Check if caching is available
    const cacheAvailable = await isAudioCacheAvailable();
    if (!cacheAvailable) {
      logger.debug('Cache not available, clearing queue');
      downloadQueue = [];
      return;
    }

    while (downloadQueue.length > 0 && activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
      // Check if we can still download
      const canDownload = await canDownloadNow();
      if (!canDownload) {
        logger.debug('Pausing downloads: timing policy not met');
        break;
      }

      const task = downloadQueue.shift();
      if (!task) break;

      activeDownloads++;
      // Don't await - let it run in parallel
      processTask(task).finally(() => {
        activeDownloads--;
        // Continue processing after each completion
        if (downloadQueue.length > 0) {
          processQueue();
        }
      });
    }
  } finally {
    isProcessing = downloadQueue.length > 0;
  }
}

async function processTask(task: DownloadTask): Promise<void> {
  try {
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to cache song ${task.songId}: ${errorMessage}`);
    
    // Don't retry if cache is not available (permanent failure)
    if (errorMessage.includes('not available') || errorMessage.includes('not found')) {
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
// Network Change Listener
// ============================================================

/**
 * Resume downloads when network becomes available
 */
export function initDownloadManager(): void {
  // Listen for online events
  window.addEventListener('online', async () => {
    const canDownload = await canDownloadNow();
    if (canDownload && downloadQueue.length > 0) {
      logger.info('Network available, resuming downloads');
      processQueue();
    }
  });

  // Listen for connection change (wifi-only mode)
  if ('connection' in navigator) {
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    connection?.addEventListener('change', async () => {
      const canDownload = await canDownloadNow();
      if (canDownload && downloadQueue.length > 0) {
        logger.info('Connection changed, checking download policy');
        processQueue();
      }
    });
  }

  logger.debug('Download manager initialized');
}

// ============================================================
// Cache Statistics
// ============================================================

/**
 * Get cache statistics for a library
 */
export async function getLibraryCacheStats(libraryId: string): Promise<{
  total: number;
  cached: number;
  percentage: number;
}> {
  const songs = await db.songs
    .where('libraryId')
    .equals(libraryId)
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
