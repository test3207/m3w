'use client';

import { useEffect, useRef } from 'react';

import { useAudioPlayer } from '@/lib/audio/useAudioPlayer';
import type { PlayContext } from '@/lib/audio/context';
import type { Track } from '@/lib/audio/player';
import { logger } from '@/lib/logger-client';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api-config';

type SeedContext = PlayContext;

type SeedTrack = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  coverUrl: string | null;
  duration?: number | null;
  audioUrl: string;
  mimeType?: string | null;
};

interface SeedResponse {
  success: boolean;
  data: null | {
    track: SeedTrack;
    context: SeedContext;
  };
}

export function PlaybackInitializer() {
  const { currentTrack, primeFromSeed } = useAudioPlayer();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current || currentTrack) {
      return;
    }

    let cancelled = false;
    attemptedRef.current = true;

    const bootstrap = async () => {
      try {
        const payload = await apiClient.get<SeedResponse>(API_ENDPOINTS.player.seed);
        
        if (!payload.success || !payload.data || cancelled) {
          return;
        }

        const { track, context } = payload.data;
        const normalizedTrack: Track = {
          id: track.id,
          title: track.title,
          artist: track.artist ?? undefined,
          album: track.album ?? undefined,
          coverUrl: track.coverUrl ?? undefined,
          duration: track.duration ?? undefined,
          audioUrl: track.audioUrl,
          mimeType: track.mimeType ?? undefined,
        };

        primeFromSeed({ track: normalizedTrack, context });
      } catch (error) {
        logger.error('Failed to bootstrap playback', error);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [currentTrack, primeFromSeed]);

  return null;
}
