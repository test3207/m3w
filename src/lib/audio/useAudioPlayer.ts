'use client';

/**
 * Audio Player React Hook
 * 
 * Provides audio player state and controls to React components
 */

import { useState, useEffect, useCallback } from 'react';
import { getAudioPlayer, type PlayerState, type Track } from '@/lib/audio/player';
import { getPlayQueue } from '@/lib/audio/queue';
import { getPlayContext, type PlayContext } from '@/lib/audio/context';

export function useAudioPlayer() {
  const [playerState, setPlayerState] = useState<PlayerState>(() => getAudioPlayer().getState());

  // Handle track end - auto play next
  const handleTrackEnd = useCallback((state: PlayerState) => {
    setPlayerState(state);
    const nextTrack = getPlayQueue().next();
    if (nextTrack) {
      getAudioPlayer().play(nextTrack);
    }
  }, []);

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
  const play = useCallback(async (track: Track) => {
    await getAudioPlayer().play(track);
  }, []);

  // Play from queue
  const playFromQueue = useCallback(async (tracks: Track[], startIndex: number = 0, context?: PlayContext) => {
    const queue = getPlayQueue();
    queue.setQueue(tracks, startIndex);
    const track = queue.getCurrentTrack();
    if (track) {
      // Set play context if provided
      if (context) {
        getPlayContext().setContext(context);
      }
      await getAudioPlayer().play(track);
    }
  }, []);

  // Pause
  const pause = useCallback(() => {
    getAudioPlayer().pause();
  }, []);

  // Resume
  const resume = useCallback(() => {
    getAudioPlayer().resume();
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (playerState.isPlaying) {
      getAudioPlayer().pause();
    } else {
      getAudioPlayer().resume();
    }
  }, [playerState.isPlaying]);

  // Next track
  const next = useCallback(async () => {
    const queue = getPlayQueue();
    const nextTrack = queue.next();
    if (nextTrack) {
      await getAudioPlayer().play(nextTrack);
    }
  }, []);

  // Previous track
  const previous = useCallback(async () => {
    const queue = getPlayQueue();
    const prevTrack = queue.previous();
    if (prevTrack) {
      await getAudioPlayer().play(prevTrack);
    }
  }, []);

  // Seek
  const seek = useCallback((position: number) => {
    getAudioPlayer().seek(position);
  }, []);

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
    return enabled;
  }, []);

  // Cycle repeat mode
  const cycleRepeat = useCallback(() => {
    const mode = getPlayQueue().cycleRepeatMode();
    return mode;
  }, []);

  return {
    // State
    ...playerState,
    queueState: getPlayQueue().getState(),
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
  };
}
