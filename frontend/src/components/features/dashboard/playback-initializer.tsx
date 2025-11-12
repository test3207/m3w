'use client';

import { useEffect, useRef } from 'react';

import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import type { PlayContext } from '@/lib/audio/context';
import type { Track } from '@/lib/audio/player';
import { logger } from '@/lib/logger-client';
import { api } from '@/services';

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
        const payload = await api.main.player.getSeed();
        
        if (!payload || cancelled) {
          return;
        }

        const { track, context } = payload;
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

        const normalizedContext: PlayContext = {
          type: context.type,
          id: context.id,
          name: context.name ?? '',
        };

        primeFromSeed({ track: normalizedTrack, context: normalizedContext });
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
