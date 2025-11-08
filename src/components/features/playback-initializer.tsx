'use client';

import { useEffect, useRef } from 'react';

import { useAudioPlayer } from '@/lib/audio/useAudioPlayer';
import type { PlayContext } from '@/lib/audio/context';
import type { Track } from '@/lib/audio/player';
import { logger } from '@/lib/logger';

type SeedContext = PlayContext;

type SeedTrack = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  coverUrl: string | null;
  duration?: number | null;
  audioUrl: string;
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
        const response = await fetch('/api/player/seed', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const payload: SeedResponse = await response.json();
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
        };

        primeFromSeed({ track: normalizedTrack, context });
      } catch (error) {
        logger.error({ err: error }, 'Failed to bootstrap playback');
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [currentTrack, primeFromSeed]);

  return null;
}
