import { streamApiClient } from '@/services/api/main/stream-client';
import { logger } from '@/lib/logger-client';
import { useAuthStore } from '@/stores/authStore';

/**
 * Prefetch audio blob for improved playback experience
 * Service Worker handles caching for both Guest and Auth modes.
 * 
 * @param url - Stream URL (/api/songs/:id/stream)
 * @returns Object URL for blob or null (use original URL)
 */
export async function prefetchAudioBlob(url: string): Promise<string | null> {
  try {
    // Check if user is authenticated before trying to prefetch
    // Guest mode: Service Worker will serve from cache, no prefetch needed
    // Auth mode: Prefetch requires valid auth token to access backend stream
    const { isAuthenticated, isGuest } = useAuthStore.getState();
    
    if (!isAuthenticated) {
      logger.debug('Skipping prefetch: user not authenticated', { url });
      return null;
    }
    
    if (isGuest) {
      // Guest mode: Files should already be in cache (uploaded locally)
      // Service Worker will serve them directly
      logger.debug('Skipping prefetch for guest mode (served by Service Worker)', { url });
      return null;
    }
    
    // Auth mode: Prefetch to blob URL for smoother playback
    const response = await streamApiClient.get(url);
    if (!response.ok) {
      // Non-fatal: prefetch is optional optimization
      logger.debug('Prefetch returned non-ok status', { url, status: response.status });
      return null;
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    // Non-fatal: prefetch is optional optimization, player will use streaming URL
    logger.debug('Prefetch skipped (will use streaming URL)', { url, error });
    return null;
  }
}
