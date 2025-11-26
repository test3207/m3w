import { streamApiClient } from '@/services/api/main/stream-client';
import { logger } from '@/lib/logger-client';
import { useAuthStore } from '@/stores/authStore';

export async function prefetchAudioBlob(url: string): Promise<string | null> {
  try {
    // Guest mode: URLs starting with /guest/ are already cached in Cache Storage
    // Service Worker will serve them directly, no need to prefetch
    if (url.startsWith('/guest/songs/')) {
      logger.debug('Skipping prefetch for guest URL (served by Service Worker)', { url });
      return null; // Return null to use original URL
    }
    
    // Check if user is authenticated before trying to prefetch
    // Prefetch requires valid auth token to access backend stream
    const { isAuthenticated, isGuest } = useAuthStore.getState();
    if (!isAuthenticated || isGuest) {
      logger.debug('Skipping prefetch: user not authenticated', { url });
      return null;
    }
    
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
