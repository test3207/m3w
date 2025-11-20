import { streamApiClient } from '@/services/api/main/stream-client';
import { logger } from '@/lib/logger-client';

export async function prefetchAudioBlob(url: string): Promise<string | null> {
  try {
    // Guest mode: URLs starting with /guest/ are already cached in Cache Storage
    // Service Worker will serve them directly, no need to prefetch
    if (url.startsWith('/guest/songs/')) {
      logger.info('Skipping prefetch for guest URL (served by Service Worker)', { url });
      return null; // Return null to use original URL
    }
    
    const response = await streamApiClient.get(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    logger.error('Failed to prefetch audio blob', error);
    return null;
  }
}
