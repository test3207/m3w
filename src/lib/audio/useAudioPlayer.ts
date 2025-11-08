'use client';

/**
 * Audio Player React Hook
 * 
 * Provides audio player state and controls to React components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAudioPlayer, type PlayerState, type Track } from '@/lib/audio/player';
import { getPlayQueue } from '@/lib/audio/queue';
import { getPlayContext, type PlayContext } from '@/lib/audio/context';
import type { RepeatMode } from '@/lib/audio/queue';

interface PlaybackPreferencesResponse {
  success: boolean;
  data?: {
    shuffleEnabled: boolean;
    repeatMode: RepeatMode;
  } | null;
}

interface PlaybackProgressResponse {
  success: boolean;
  data?: {
    track: Track;
    position: number;
    context?: PlayContext | null;
    updatedAt: string;
  } | null;
}

interface PrimePlaybackPayload {
  track: Track;
  context?: PlayContext;
  queue?: Track[];
  startIndex?: number;
}

export function useAudioPlayer() {
  const [playerState, setPlayerState] = useState<PlayerState>(() => getAudioPlayer().getState());
  const [queueState, setQueueState] = useState(() => getPlayQueue().getState());
  const resumeProgressRef = useRef<{ trackId: string; position: number } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadInitialPlaybackState = async () => {
      try {
        const response = await fetch('/api/player/preferences', { cache: 'no-store' });
        if (response.ok) {
          const json = (await response.json()) as PlaybackPreferencesResponse;
          if (json?.data) {
            const queue = getPlayQueue();
            queue.setRepeatMode(json.data.repeatMode);
            queue.setShuffle(json.data.shuffleEnabled);

            if (isMounted) {
              setQueueState(queue.getState());
              setPlayerState(getAudioPlayer().getState());
            }
          }
        }
      } catch (error) {
        console.error('Failed to load playback preferences', error);
      }

      try {
        const response = await fetch('/api/player/progress', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const json = (await response.json()) as PlaybackProgressResponse;
        const progress = json?.data;
        if (!progress?.track) {
          return;
        }

        const queue = getPlayQueue();
        const player = getAudioPlayer();
        player.setPendingSeek(progress.position);
        const track: Track = {
          id: progress.track.id,
          title: progress.track.title,
          artist: progress.track.artist ?? undefined,
          album: progress.track.album ?? undefined,
          coverUrl: progress.track.coverUrl ?? undefined,
          duration: progress.track.duration ?? undefined,
          audioUrl: progress.track.audioUrl,
          mimeType: progress.track.mimeType ?? undefined,
        };

        queue.setQueue([track], 0);
        if (progress.context) {
          getPlayContext().setContext({
            ...progress.context,
            name: progress.context.name ?? '',
          });
        }

        resumeProgressRef.current = {
          trackId: track.id,
          position: progress.position,
        };

        player.prime(track);

        if (isMounted) {
          const snapshot = player.getState();
          setQueueState(queue.getState());
          setPlayerState({
            ...snapshot,
            currentTrack: track,
            currentTime: progress.position,
            duration: track.duration ?? snapshot.duration,
            isPlaying: false,
          });
        }
      } catch (error) {
        console.error('Failed to load playback progress', error);
      }
    };

    void loadInitialPlaybackState();

    return () => {
      isMounted = false;
    };
  }, []);


  const persistPreferences = useCallback(
    (preferences: Partial<{ shuffleEnabled: boolean; repeatMode: RepeatMode }>) => {
      void fetch('/api/player/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      }).catch((error) => {
        console.error('Failed to persist playback preferences', error);
      });
    },
    []
  );

  const persistProgress = useCallback((positionOverride?: number) => {
    const state = getAudioPlayer().getState();
    const track = state.currentTrack;

    if (!track) {
      return;
    }

    const context = getPlayContext().getContext();
    const position = Math.max(
      0,
      Math.min(86_400, Math.round(positionOverride ?? state.currentTime))
    );

    const payload = {
      songId: track.id,
      position,
      contextType: context?.type,
      contextId: context?.id,
      contextName: context?.name,
    };

    void fetch('/api/player/progress', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
      console.error('Failed to persist playback progress', error);
    });
  }, []);

  const applyResumeProgress = useCallback(
    (trackId: string): number | null => {
      const pending = resumeProgressRef.current;
      if (!pending || pending.trackId !== trackId) {
        return null;
      }

      resumeProgressRef.current = null;
      const player = getAudioPlayer();
      player.setPendingSeek(pending.position);
      const state = player.getState();
      if (state.isPlaying) {
        player.seek(pending.position);
      }
      setPlayerState((prev) => ({
        ...prev,
        currentTime: pending.position,
      }));
      return pending.position;
    },
    []
  );

  // Handle track end - auto play next and persist progress
  const handleTrackEnd = useCallback(
    (state: PlayerState) => {
      setPlayerState(state);
      const queue = getPlayQueue();
      const nextTrack = queue.next();
      setQueueState(queue.getState());
      if (nextTrack) {
        void getAudioPlayer()
          .play(nextTrack)
          .then(() => {
            const applied = applyResumeProgress(nextTrack.id);
            persistProgress(applied ?? 0);
          })
          .catch((error) => {
            console.error('Failed to auto-play next track', error);
          });
      }
    },
    [applyResumeProgress, persistProgress]
  );

  // Subscribe to all player events
  useEffect(() => {
    const player = getAudioPlayer();
    const unsubscribers = [
      player.on('play', setPlayerState),
      player.on('pause', setPlayerState),
      player.on('end', handleTrackEnd),
      player.on('load', setPlayerState),
      player.on('seek', setPlayerState),
      player.on('volume', setPlayerState),
      player.on('error', setPlayerState),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [handleTrackEnd]);

  // Play a track
  const play = useCallback(
    async (track: Track) => {
      await getAudioPlayer().play(track);
      const applied = applyResumeProgress(track.id);
      persistProgress(applied ?? 0);
    },
    [applyResumeProgress, persistProgress]
  );

  // Play from queue
  const playFromQueue = useCallback(
    async (tracks: Track[], startIndex: number = 0, context?: PlayContext) => {
      const queue = getPlayQueue();
      queue.setQueue(tracks, startIndex);
      setQueueState(queue.getState());
      const track = queue.getCurrentTrack();
      if (track) {
        // Set play context if provided
        if (context) {
          getPlayContext().setContext(context);
        }
        await getAudioPlayer().play(track);
        const applied = applyResumeProgress(track.id);
        persistProgress(applied ?? 0);
      }
    },
    [applyResumeProgress, persistProgress]
  );

  // Pause
  const pause = useCallback(() => {
    getAudioPlayer().pause();
  }, []);

  // Resume
  const resume = useCallback(() => {
    const currentTrack = getAudioPlayer().getState().currentTrack;
    const applied = currentTrack ? applyResumeProgress(currentTrack.id) : null;
    getAudioPlayer().resume();
    if (applied !== null) {
      persistProgress(applied);
    }
  }, [applyResumeProgress, persistProgress]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (playerState.isPlaying) {
      getAudioPlayer().pause();
    } else {
      resume();
    }
  }, [playerState.isPlaying, resume]);

  // Next track
  const next = useCallback(async () => {
    const queue = getPlayQueue();
    const nextTrack = queue.next();
    if (nextTrack) {
      await getAudioPlayer().play(nextTrack);
      const applied = applyResumeProgress(nextTrack.id);
      persistProgress(applied ?? 0);
    }
    setQueueState(queue.getState());
  }, [applyResumeProgress, persistProgress]);

  // Previous track
  const previous = useCallback(async () => {
    const queue = getPlayQueue();
    const prevTrack = queue.previous();
    if (prevTrack) {
      await getAudioPlayer().play(prevTrack);
      const applied = applyResumeProgress(prevTrack.id);
      persistProgress(applied ?? 0);
    }
    setQueueState(queue.getState());
  }, [applyResumeProgress, persistProgress]);

  // Seek
  const seek = useCallback(
    (position: number) => {
      getAudioPlayer().seek(position);
      persistProgress(position);
    },
    [persistProgress]
  );

  // Set volume
  const setVolume = useCallback((volume: number) => {
    getAudioPlayer().setVolume(volume);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    getAudioPlayer().setMuted(!playerState.isMuted);
  }, [playerState.isMuted]);

  // Toggle shuffle
  const toggleShuffle = useCallback(() => {
    const queue = getPlayQueue();
    const enabled = queue.toggleShuffle();
    // Re-render with updated queue state
    setPlayerState(getAudioPlayer().getState());
    setQueueState(queue.getState());
    persistPreferences({ shuffleEnabled: enabled });
    return enabled;
  }, [persistPreferences]);

  // Cycle repeat mode
  const cycleRepeat = useCallback(() => {
    const queue = getPlayQueue();
    const mode = queue.cycleRepeatMode();
    setPlayerState(getAudioPlayer().getState());
    setQueueState(queue.getState());
    persistPreferences({ repeatMode: mode });
    return mode;
  }, [persistPreferences]);

  const primeFromSeed = useCallback(
    (payload: PrimePlaybackPayload) => {
      const queue = getPlayQueue();
      const tracks = payload.queue ?? [payload.track];
      const startIndex = payload.startIndex ?? 0;

      queue.setQueue(tracks, startIndex);
      setQueueState(queue.getState());

      if (payload.context) {
        getPlayContext().setContext(payload.context);
      }

      getAudioPlayer().prime(payload.track);
      setPlayerState(getAudioPlayer().getState());
      persistProgress(0);
    },
    [persistProgress]
  );

  const trackedSongId = playerState.currentTrack?.id;
  const isPlaying = playerState.isPlaying;

  useEffect(() => {
    if (!trackedSongId) {
      return;
    }

    persistProgress();

    if (!isPlaying) {
      return;
    }

    const interval = setInterval(() => {
      persistProgress();
    }, 5000);

    return () => {
      clearInterval(interval);
      persistProgress();
    };
  }, [trackedSongId, isPlaying, persistProgress]);

  return {
    // State
    ...playerState,
    queueState,
    playContext: getPlayContext().getContext(),

    // Controls
    play,
    playFromQueue,
    pause,
    resume,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    primeFromSeed,
  };
}
