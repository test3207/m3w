'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Track } from '@/lib/audio/player';
import { logger } from '@/lib/logger-client';
import { api } from '@/lib/api/router';

const MAX_PRELOADED_TRACKS = 5;

type PreloadResult = string | null;

type PreloaderRefs = {
  urls: Map<string, string>;
  promises: Map<string, Promise<PreloadResult>>;
};

function createRefs(): PreloaderRefs {
  return {
    urls: new Map<string, string>(),
    promises: new Map<string, Promise<PreloadResult>>(),
  };
}

export function useTrackPreloader(limit: number = MAX_PRELOADED_TRACKS) {
  const refs = useRef<PreloaderRefs>(createRefs());

  const revokeObjectUrl = useCallback((url: string) => {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
      return;
    }
    URL.revokeObjectURL(url);
  }, []);

  const ensurePreloadedTrack = useCallback(
    async (track: Track): Promise<PreloadResult> => {
      if (typeof window === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return null;
      }

      const { urls, promises } = refs.current;

      const cachedUrl = urls.get(track.id);
      if (cachedUrl) {
        return cachedUrl;
      }

      const existingPromise = promises.get(track.id);
      if (existingPromise) {
        return existingPromise;
      }

      const preloadPromise: Promise<PreloadResult> = (async () => {
        try {
          // Fetch audio through API router (adds Authorization header automatically)
          const response = await api.get(track.audioUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status}`);
          }

          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          urls.set(track.id, objectUrl);

          // LRU eviction
          if (urls.size > limit) {
            const iterator = urls.keys().next();
            if (!iterator.done) {
              const oldestKey = iterator.value;
              if (oldestKey !== track.id) {
                const oldestUrl = urls.get(oldestKey);
                if (oldestUrl) {
                  revokeObjectUrl(oldestUrl);
                }
                urls.delete(oldestKey);
              }
            }
          }

          return objectUrl;
        } catch (error) {
          logger.error('Failed to preload track', error);
          return null;
        } finally {
          promises.delete(track.id);
        }
      })();

      promises.set(track.id, preloadPromise);
      return preloadPromise;
    },
    [limit, revokeObjectUrl]
  );

  const prepareTrack = useCallback(
    async (track: Track): Promise<Track> => {
      const resolvedUrl = await ensurePreloadedTrack(track);
      return resolvedUrl ? { ...track, resolvedUrl } : track;
    },
    [ensurePreloadedTrack]
  );

  const primeTrack = useCallback(
    (track: Track | null | undefined) => {
      if (!track) {
        return;
      }
      void ensurePreloadedTrack(track);
    },
    [ensurePreloadedTrack]
  );

  const preloadNextInQueue = useCallback(
    (tracks: Track[], currentIndex: number) => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= tracks.length) {
        return;
      }
      const nextTrack = tracks[nextIndex];
      if (nextTrack) {
        void ensurePreloadedTrack(nextTrack);
      }
    },
    [ensurePreloadedTrack]
  );

  useEffect(() => {
    const snapshot = refs.current;
    return () => {
      snapshot.promises.clear();
      snapshot.urls.forEach(revokeObjectUrl);
      snapshot.urls.clear();
    };
  }, [revokeObjectUrl]);

  return {
    prepareTrack,
    primeTrack,
    preloadNextInQueue,
  };
}
