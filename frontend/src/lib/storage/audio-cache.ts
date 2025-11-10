/**
 * Audio Cache Service
 * 
 * Manages offline audio file caching using Cache Storage API:
 * - Only activates after PWA installation + persistent storage granted
 * - Downloads audio files for offline playback
 * - Implements cache eviction strategy (LRU)
 * - Provides progress tracking
 */

import { getStorageStatus, hasEnoughQuota } from './quota-manager';
import { db } from '../db/schema';
import { API_ENDPOINTS } from '../api-config';

const AUDIO_CACHE_NAME = 'm3w-audio-cache-v1';
const ESTIMATED_SONG_SIZE = 5 * 1024 * 1024; // 5 MB average per song
const MIN_FREE_QUOTA = 100 * 1024 * 1024; // Keep 100 MB free

export interface CacheProgress {
  songId: string;
  title: string;
  progress: number; // 0-100
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}

export interface CacheStats {
  totalCached: number;
  totalSize: number;
  songs: Array<{
    songId: string;
    url: string;
    size: number;
    cachedAt: number;
  }>;
}

/**
 * Check if audio caching is available
 */
export async function isAudioCacheAvailable(): Promise<boolean> {
  const status = await getStorageStatus();
  return status.canCache;
}

/**
 * Get audio cache
 */
async function getAudioCache(): Promise<Cache> {
  return await caches.open(AUDIO_CACHE_NAME);
}

/**
 * Cache a single song by ID
 */
export async function cacheSong(
  songId: string,
  onProgress?: (progress: CacheProgress) => void
): Promise<void> {
  const available = await isAudioCacheAvailable();
  if (!available) {
    throw new Error('Audio caching not available. Please install PWA and grant storage permission.');
  }

  // Get song metadata from IndexedDB
  const song = await db.songs.get(songId);
  if (!song) {
    throw new Error(`Song ${songId} not found`);
  }

  // Check if enough quota available
  const hasQuota = await hasEnoughQuota(ESTIMATED_SONG_SIZE + MIN_FREE_QUOTA);
  if (!hasQuota) {
    throw new Error('Not enough storage quota available');
  }

  const streamUrl = API_ENDPOINTS.songs.stream(songId);

  try {
    onProgress?.({
      songId,
      title: song.title,
      progress: 0,
      status: 'downloading',
    });

    // Fetch the audio file
    const response = await fetch(streamUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    // Clone response for caching (can only read body once)
    const responseClone = response.clone();

    // Cache the response
    const cache = await getAudioCache();
    await cache.put(streamUrl, responseClone);

    onProgress?.({
      songId,
      title: song.title,
      progress: 100,
      status: 'completed',
    });

    console.log(`[AudioCache] Cached song ${songId}: ${song.title}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    onProgress?.({
      songId,
      title: song.title,
      progress: 0,
      status: 'failed',
      error: errorMessage,
    });

    console.error(`[AudioCache] Failed to cache song ${songId}:`, error);
    throw error;
  }
}

/**
 * Cache multiple songs (batched)
 */
export async function cacheSongs(
  songIds: string[],
  onProgress?: (progress: CacheProgress) => void
): Promise<void> {
  console.log(`[AudioCache] Caching ${songIds.length} songs...`);

  for (const songId of songIds) {
    try {
      await cacheSong(songId, onProgress);
    } catch (error) {
      console.error(`[AudioCache] Failed to cache song ${songId}:`, error);
      // Continue with next song instead of failing entire batch
    }
  }

  console.log(`[AudioCache] Finished caching batch`);
}

/**
 * Check if a song is cached
 */
export async function isSongCached(songId: string): Promise<boolean> {
  try {
    const cache = await getAudioCache();
    const streamUrl = API_ENDPOINTS.songs.stream(songId);
    const response = await cache.match(streamUrl);
    return response !== undefined;
  } catch (error) {
    console.error(`[AudioCache] Error checking cache for song ${songId}:`, error);
    return false;
  }
}

/**
 * Remove a song from cache
 */
export async function removeCachedSong(songId: string): Promise<boolean> {
  try {
    const cache = await getAudioCache();
    const streamUrl = API_ENDPOINTS.songs.stream(songId);
    const deleted = await cache.delete(streamUrl);
    
    if (deleted) {
      console.log(`[AudioCache] Removed cached song ${songId}`);
    }
    
    return deleted;
  } catch (error) {
    console.error(`[AudioCache] Failed to remove cached song ${songId}:`, error);
    return false;
  }
}

/**
 * Get all cached songs
 */
export async function getCachedSongs(): Promise<string[]> {
  try {
    const cache = await getAudioCache();
    const requests = await cache.keys();
    
    // Extract song IDs from URLs like /api/songs/{id}/stream
    const songIds = requests
      .map((request) => {
        const match = request.url.match(/\/songs\/([^/]+)\/stream/);
        return match ? match[1] : null;
      })
      .filter((id): id is string => id !== null);
    
    return songIds;
  } catch (error) {
    console.error('[AudioCache] Failed to get cached songs:', error);
    return [];
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  try {
    const cache = await getAudioCache();
    const requests = await cache.keys();
    
    const songs = await Promise.all(
      requests.map(async (request) => {
        const response = await cache.match(request);
        const size = response ? parseInt(response.headers.get('content-length') || '0', 10) : 0;
        
        const match = request.url.match(/\/songs\/([^/]+)\/stream/);
        const songId = match ? match[1] : 'unknown';
        
        return {
          songId,
          url: request.url,
          size,
          cachedAt: Date.now(), // Note: Cache API doesn't track timestamps, using current time
        };
      })
    );
    
    const totalSize = songs.reduce((sum, song) => sum + song.size, 0);
    
    return {
      totalCached: songs.length,
      totalSize,
      songs,
    };
  } catch (error) {
    console.error('[AudioCache] Failed to get cache stats:', error);
    return {
      totalCached: 0,
      totalSize: 0,
      songs: [],
    };
  }
}

/**
 * Clear all cached audio files
 */
export async function clearAudioCache(): Promise<boolean> {
  try {
    const deleted = await caches.delete(AUDIO_CACHE_NAME);
    console.log(`[AudioCache] Cache cleared: ${deleted}`);
    return deleted;
  } catch (error) {
    console.error('[AudioCache] Failed to clear cache:', error);
    return false;
  }
}

/**
 * Cache all songs in a playlist
 */
export async function cachePlaylist(
  playlistId: string,
  onProgress?: (progress: CacheProgress) => void
): Promise<void> {
  console.log(`[AudioCache] Caching playlist ${playlistId}...`);

  // Get all songs in playlist from IndexedDB
  const playlistSongs = await db.playlistSongs
    .where('playlistId')
    .equals(playlistId)
    .toArray();

  const songIds = playlistSongs.map((ps) => ps.songId);

  await cacheSongs(songIds, onProgress);
}

/**
 * Cache all songs in a library
 */
export async function cacheLibrary(
  libraryId: string,
  onProgress?: (progress: CacheProgress) => void
): Promise<void> {
  console.log(`[AudioCache] Caching library ${libraryId}...`);

  // Get all songs in library from IndexedDB
  const songs = await db.songs
    .where('libraryId')
    .equals(libraryId)
    .toArray();

  const songIds = songs.map((song) => song.id);

  await cacheSongs(songIds, onProgress);
}

/**
 * Implement LRU cache eviction
 * (Note: Cache API doesn't track access time, so this is a simplified version)
 */
export async function evictOldestCachedSongs(count: number): Promise<void> {
  console.log(`[AudioCache] Evicting ${count} oldest cached songs...`);

  const stats = await getCacheStats();
  
  // Sort by cachedAt (oldest first)
  const sortedSongs = stats.songs.sort((a, b) => a.cachedAt - b.cachedAt);
  
  // Remove oldest songs
  const toRemove = sortedSongs.slice(0, count);
  
  for (const song of toRemove) {
    await removeCachedSong(song.songId);
  }
}

/**
 * Check and trigger eviction if quota is low
 */
export async function checkAndEvictIfNeeded(): Promise<void> {
  const hasQuota = await hasEnoughQuota(MIN_FREE_QUOTA);
  
  if (!hasQuota) {
    console.warn('[AudioCache] Low storage quota, evicting cached songs...');
    await evictOldestCachedSongs(10); // Remove 10 oldest songs
  }
}
