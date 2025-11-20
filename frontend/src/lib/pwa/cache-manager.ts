/**
 * Cache Manager for Guest Mode
 * Handles storing/retrieving media files in Cache Storage API
 */

const CACHE_NAME = 'm3w-media-v1';

/**
 * Store audio file in Cache Storage for guest mode
 * @param songId - Unique song ID
 * @param audioBlob - Audio file blob
 * @returns Guest stream URL
 */
export async function cacheGuestAudio(
  songId: string,
  audioBlob: Blob
): Promise<string> {
  const guestUrl = `/guest/songs/${songId}/stream`;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Create Response object from blob
    const response = new Response(audioBlob, {
      headers: {
        'Content-Type': audioBlob.type || 'audio/mpeg',
        'Content-Length': String(audioBlob.size),
        'Cache-Control': 'public, max-age=31536000', // 1 year
      },
    });
    
    // Store in cache
    await cache.put(guestUrl, response);
    
    console.log('[CacheManager] ✅ Cached guest audio:', guestUrl);
    return guestUrl;
  } catch (error) {
    console.error('[CacheManager] ❌ Failed to cache audio:', error);
    throw new Error('Failed to cache audio file');
  }
}

/**
 * Store cover image in Cache Storage for guest mode
 * @param songId - Unique song ID
 * @param coverBlob - Cover image blob
 * @returns Guest cover URL
 */
export async function cacheGuestCover(
  songId: string,
  coverBlob: Blob
): Promise<string> {
  const guestUrl = `/guest/songs/${songId}/cover`;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Create Response object from blob
    const response = new Response(coverBlob, {
      headers: {
        'Content-Type': coverBlob.type || 'image/jpeg',
        'Content-Length': String(coverBlob.size),
        'Cache-Control': 'public, max-age=31536000', // 1 year
      },
    });
    
    // Store in cache
    await cache.put(guestUrl, response);
    
    console.log('[CacheManager] ✅ Cached guest cover:', guestUrl);
    return guestUrl;
  } catch (error) {
    console.error('[CacheManager] ❌ Failed to cache cover:', error);
    throw new Error('Failed to cache cover image');
  }
}

/**
 * Check if a media file is cached
 * @param url - Media URL to check
 * @returns True if cached
 */
export async function isMediaCached(url: string): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    return !!response;
  } catch (error) {
    console.error('[CacheManager] Failed to check cache:', error);
    return false;
  }
}

/**
 * Delete a media file from cache
 * @param url - Media URL to delete
 */
export async function deleteFromCache(url: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(url);
    console.log('[CacheManager] 🗑️ Deleted from cache:', url);
  } catch (error) {
    console.error('[CacheManager] Failed to delete from cache:', error);
    throw error;
  }
}

/**
 * Download a song for offline use (Auth users)
 * @param streamUrl - Stream URL (e.g., /api/songs/:id/stream)
 * @param coverUrl - Cover URL (e.g., /api/songs/:id/cover)
 */
export async function downloadSongForOffline(
  streamUrl: string,
  coverUrl?: string
): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  
  // Download audio
  try {
    const audioResponse = await fetch(streamUrl);
    if (audioResponse.ok) {
      await cache.put(streamUrl, audioResponse);
      console.log('[CacheManager] ✅ Downloaded audio:', streamUrl);
    }
  } catch (error) {
    console.error('[CacheManager] Failed to download audio:', error);
    throw error;
  }
  
  // Download cover (optional)
  if (coverUrl) {
    try {
      const coverResponse = await fetch(coverUrl);
      if (coverResponse.ok) {
        await cache.put(coverUrl, coverResponse);
        console.log('[CacheManager] ✅ Downloaded cover:', coverUrl);
      }
    } catch (error) {
      // Cover download failure is non-fatal
      console.warn('[CacheManager] Failed to download cover:', error);
    }
  }
}

/**
 * Clear all cached media
 */
export async function clearAllMediaCache(): Promise<void> {
  try {
    await caches.delete(CACHE_NAME);
    await caches.open(CACHE_NAME); // Recreate empty cache
    console.log('[CacheManager] ✅ All media cache cleared');
  } catch (error) {
    console.error('[CacheManager] Failed to clear cache:', error);
    throw error;
  }
}
