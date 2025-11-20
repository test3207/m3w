import { streamApiClient } from '@/services/api/main/stream-client';
import { logger } from '@/lib/logger-client';

export async function prefetchAudioBlob(url: string): Promise<string | null> {
  try {
    const response = await streamApiClient.get(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    logger.error('Failed to prefetch audio blob', error);
    return null;
  }
}
