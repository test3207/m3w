/**
 * Audio Player React Hook
 * 
 * Provides audio player state and controls to React components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAudioPlayer, type PlayerState, type Track } from '@/lib/audio/player';
import { getPlayQueue, RepeatMode } from '@/lib/audio/queue';
import { getPlayContext, type PlayContext } from '@/lib/audio/context';
import { useTrackPreloader } from '@/hooks/useTrackPreloader';
import { logger } from '@/lib/logger-client';
import { api } from '@/services';
import { MAIN_API_ENDPOINTS } from '@/services/api/main/endpoints';

interface PrimePlaybackPayload {
  track: Track;
  context?: PlayContext;
  queue?: Track[];
  startIndex?: number;
}

const MAX_PRELOADED_TRACKS = 5;

// Global flag to prevent concurrent initialization in React StrictMode
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

export function useAudioPlayer() {
  const [playerState, setPlayerState] = useState<PlayerState>(() => getAudioPlayer().getState());
  const [queueState, setQueueState] = useState(() => getPlayQueue().getState());
  const resumeProgressRef = useRef<{ trackId: string; position: number } | null>(null);
  const lastProgressPersistRef = useRef<{ trackId: string; position: number; timestamp: number } | null>(null);
  const { prepareTrack, preloadNextInQueue } = useTrackPreloader(
    MAX_PRELOADED_TRACKS
  );

  // Initialize preferences separately from playback state
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await api.main.player.getPreferences();
        if (preferences) {
          const queue = getPlayQueue();
          // Validate and use repeatMode from preferences (enum values are already strings)
          const isValidRepeatMode = (value: string): value is RepeatMode =>
            Object.values(RepeatMode).includes(value as RepeatMode);
          const repeatMode = isValidRepeatMode(preferences.repeatMode)
            ? preferences.repeatMode
            : RepeatMode.Off;
          queue.setRepeatMode(repeatMode);
          queue.setShuffle(preferences.shuffleEnabled);
          setQueueState(queue.getState());
        }
      } catch (error) {
        logger.error('Failed to load playback preferences', error);
      }
    };

    void loadPreferences();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialPlaybackState = async () => {
      // Prevent concurrent initialization (React StrictMode protection)
      if (isInitializing) {
        await initializationPromise;
        return;
      }

      isInitializing = true;

      initializationPromise = (async () => {
        try {
          await doLoadInitialPlaybackState();
        } finally {
          isInitializing = false;
          initializationPromise = null;
        }
      })();

      await initializationPromise;
    };

    const doLoadInitialPlaybackState = async () => {
      // Helper function to load default seed
      const loadDefaultSeed = async () => {
        try {
          const seed = await api.main.player.getSeed();
          logger.info('Loaded default seed', { hasSeed: !!seed, trackId: seed?.track?.id, context: seed?.context });

          if (!seed?.track) {
            return;
          }

          const queue = getPlayQueue();
          const player = getAudioPlayer();
          const track: Track = {
            id: seed.track.id,
            title: seed.track.title,
            artist: seed.track.artist ?? undefined,
            album: seed.track.album ?? undefined,
            coverUrl: seed.track.coverUrl ?? undefined,
            duration: seed.track.duration ?? undefined,
            audioUrl: seed.track.audioUrl,
            mimeType: seed.track.mimeType ?? undefined,
          };

          logger.info('Priming track from seed', {
            trackId: track.id,
            audioUrl: track.audioUrl
          });

          // Load full queue based on context
          if (seed.context) {
            try {
              let fullTracks: Track[] = [];
              let currentIndex = 0;

              if (seed.context.type === 'playlist' && seed.context.id) {
                const songs = await api.main.playlists.getSongs(seed.context.id);
                if (songs) {
                  fullTracks = songs.map((song) => ({
                    id: song.id,
                    title: song.title,
                    artist: song.artist ?? undefined,
                    album: song.album ?? undefined,
                    coverUrl: song.coverUrl ?? undefined,
                    duration: song.duration ?? undefined,
                    audioUrl: MAIN_API_ENDPOINTS.songs.stream(song.id),
                    mimeType: song.mimeType ?? 'audio/mpeg',
                  }));
                  currentIndex = fullTracks.findIndex(t => t.id === track.id);
                  if (currentIndex === -1) currentIndex = 0;
                  logger.info('Loaded full playlist queue from seed', {
                    playlistId: seed.context.id,
                    tracksCount: fullTracks.length,
                    currentIndex
                  });
                }
              } else if (seed.context.type === 'library' && seed.context.id) {
                const songs = await api.main.libraries.getSongs(seed.context.id);
                if (songs) {
                  fullTracks = songs.map((song) => ({
                    id: song.id,
                    title: song.title,
                    artist: song.artist ?? undefined,
                    album: song.album ?? undefined,
                    coverUrl: song.coverUrl ?? undefined,
                    duration: song.duration ?? undefined,
                    audioUrl: MAIN_API_ENDPOINTS.songs.stream(song.id),
                    mimeType: song.mimeType ?? 'audio/mpeg',
                  }));
                  currentIndex = fullTracks.findIndex(t => t.id === track.id);
                  if (currentIndex === -1) currentIndex = 0;
                  logger.info('Loaded full library queue from seed', {
                    libraryId: seed.context.id,
                    tracksCount: fullTracks.length,
                    currentIndex
                  });
                }
              }

              if (fullTracks.length > 0) {
                queue.setQueue(fullTracks, currentIndex);
              } else {
                queue.setQueue([track], 0);
              }
            } catch (error) {
              logger.error('Failed to load full queue from seed, using single track', error);
              queue.setQueue([track], 0);
            }

            getPlayContext().setContext({
              ...seed.context,
              name: seed.context.name ?? '',
            });
          } else {
            queue.setQueue([track], 0);
          }

          // Prepare track with preloader before priming
          const playableTrack = await prepareTrack(track);
          player.prime(playableTrack);

          if (isMounted) {
            const snapshot = player.getState();
            setPlayerState({
              ...snapshot,
              currentTrack: track,
              currentTime: 0,
              duration: track.duration ?? snapshot.duration,
              isPlaying: false,
            });
          }
        } catch (error) {
          logger.error('Failed to load default playback seed', error);
        }
      };

      try {
        const progress = await api.main.player.getProgress();
        logger.info('Loaded playback progress', { hasProgress: !!progress, trackId: progress?.track?.id });

        if (!progress?.track) {
          // No progress data, try to load seed
          await loadDefaultSeed();
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

        logger.info('Priming track from progress', {
          trackId: track.id,
          audioUrl: track.audioUrl,
          position: progress.position,
          context: progress.context
        });

        // Load full queue based on context
        if (progress.context) {
          try {
            let fullTracks: Track[] = [];
            let currentIndex = 0;

            if (progress.context.type === 'playlist' && progress.context.id) {
              const songs = await api.main.playlists.getSongs(progress.context.id);
              if (songs) {
                fullTracks = songs.map((song) => ({
                  id: song.id,
                  title: song.title,
                  artist: song.artist ?? undefined,
                  album: song.album ?? undefined,
                  coverUrl: song.coverUrl ?? undefined,
                  duration: song.duration ?? undefined,
                  audioUrl: MAIN_API_ENDPOINTS.songs.stream(song.id),
                  mimeType: song.mimeType ?? 'audio/mpeg',
                }));
                currentIndex = fullTracks.findIndex(t => t.id === track.id);
                if (currentIndex === -1) currentIndex = 0;
                logger.info('Loaded full playlist queue', {
                  playlistId: progress.context.id,
                  tracksCount: fullTracks.length,
                  currentIndex
                });
              }
            } else if (progress.context.type === 'library' && progress.context.id) {
              const songs = await api.main.libraries.getSongs(progress.context.id);
              if (songs) {
                fullTracks = songs.map((song) => ({
                  id: song.id,
                  title: song.title,
                  artist: song.artist ?? undefined,
                  album: song.album ?? undefined,
                  coverUrl: song.coverUrl ?? undefined,
                  duration: song.duration ?? undefined,
                  audioUrl: MAIN_API_ENDPOINTS.songs.stream(song.id),
                  mimeType: song.mimeType ?? 'audio/mpeg',
                }));
                currentIndex = fullTracks.findIndex(t => t.id === track.id);
                if (currentIndex === -1) currentIndex = 0;
                logger.info('Loaded full library queue', {
                  libraryId: progress.context.id,
                  tracksCount: fullTracks.length,
                  currentIndex
                });
              }
            }

            if (fullTracks.length > 0) {
              queue.setQueue(fullTracks, currentIndex);
            } else {
              queue.setQueue([track], 0);
            }
          } catch (error) {
            logger.error('Failed to load full queue, using single track', error);
            queue.setQueue([track], 0);
          }

          getPlayContext().setContext({
            ...progress.context,
            name: progress.context.name ?? '',
          });
        } else {
          queue.setQueue([track], 0);
        }

        resumeProgressRef.current = {
          trackId: track.id,
          position: progress.position,
        };

        // Prepare track with preloader before priming
        const playableTrack = await prepareTrack(track);
        player.prime(playableTrack);

        if (isMounted) {
          const snapshot = player.getState();
          setPlayerState({
            ...snapshot,
            currentTrack: track,
            currentTime: progress.position,
            duration: track.duration ?? snapshot.duration,
            isPlaying: false,
          });
        }
      } catch (error) {
        logger.error('Failed to load playback progress', error);
      }
    };

    void loadInitialPlaybackState();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const persistPreferences = useCallback(
    (preferences: Partial<{ shuffleEnabled: boolean; repeatMode: RepeatMode }>) => {
      // Convert local preferences to API input
      const apiPreferences: { shuffleEnabled?: boolean; repeatMode?: RepeatMode } = {};
      if (preferences.shuffleEnabled !== undefined) {
        apiPreferences.shuffleEnabled = preferences.shuffleEnabled;
      }
      if (preferences.repeatMode !== undefined) {
        apiPreferences.repeatMode = preferences.repeatMode;
      }
      void api.main.player.updatePreferences(apiPreferences).catch((error: unknown) => {
        logger.error('Failed to persist playback preferences', error);
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

    // Debounce: skip if same track and position persisted within last 500ms
    const now = Date.now();
    const last = lastProgressPersistRef.current;
    if (last &&
      last.trackId === track.id &&
      last.position === position &&
      now - last.timestamp < 500) {
      return;
    }

    const payload = {
      songId: track.id,
      position,
      contextType: (context?.type === 'library' || context?.type === 'playlist') ? context.type : undefined,
      contextId: context?.id,
      contextName: context?.name,
    };

    lastProgressPersistRef.current = {
      trackId: track.id,
      position,
      timestamp: now,
    };

    void api.main.player.updateProgress(payload).catch((error: unknown) => {
      logger.error('Failed to persist playback progress', error);
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

  const preloadUpcomingTrack = useCallback(() => {
    const queue = getPlayQueue();
    const state = queue.getState();
    preloadNextInQueue(state.tracks, state.currentIndex);
  }, [preloadNextInQueue]);

  const playWithPreload = useCallback(
    async (track: Track) => {
      const playableTrack = await prepareTrack(track);
      await getAudioPlayer().play(playableTrack);
      const applied = applyResumeProgress(track.id);
      persistProgress(applied ?? 0);
      preloadUpcomingTrack();
    },
    [prepareTrack, applyResumeProgress, persistProgress, preloadUpcomingTrack]
  );

  // Handle track end - auto play next and persist progress
  const handleTrackEnd = useCallback(
    (state: PlayerState) => {
      setPlayerState(state);
      const queue = getPlayQueue();
      const nextTrack = queue.next();
      setQueueState(queue.getState());
      if (nextTrack) {
        void playWithPreload(nextTrack).catch((error) => {
          logger.error('Failed to auto-play next track', error);
        });
      }
    },
    [playWithPreload]
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

  // Preload next track when queue changes
  useEffect(() => {
    preloadUpcomingTrack();
  }, [queueState.currentIndex, queueState.tracks, preloadUpcomingTrack]);

  // Play a track
  const play = useCallback(
    async (track: Track) => {
      await playWithPreload(track);
    },
    [playWithPreload]
  );

  // Play from queue
  const playFromQueue = useCallback(
    async (tracks: Track[], startIndex: number = 0, context?: PlayContext) => {
      logger.info('playFromQueue called', { tracksCount: tracks.length, startIndex, context });
      const queue = getPlayQueue();
      queue.setQueue(tracks, startIndex);
      setQueueState(queue.getState());
      const track = queue.getCurrentTrack();
      logger.info('Current track from queue', { track });
      if (track) {
        // Set play context if provided
        if (context) {
          getPlayContext().setContext(context);
        }
        await playWithPreload(track);
      } else {
        logger.warn('No track to play from queue');
      }
    },
    [playWithPreload]
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
    logger.info('Next button clicked');
    const queue = getPlayQueue();
    const currentState = queue.getState();
    logger.info('Current queue state', currentState);

    const nextTrack = queue.next();
    logger.info('Next track', { nextTrack });

    if (nextTrack) {
      await playWithPreload(nextTrack);
    } else {
      logger.warn('No next track available');
    }
    setQueueState(queue.getState());
  }, [playWithPreload]);

  // Previous track
  const previous = useCallback(async () => {
    const queue = getPlayQueue();
    const prevTrack = queue.previous();
    if (prevTrack) {
      await playWithPreload(prevTrack);
    }
    setQueueState(queue.getState());
  }, [playWithPreload]);

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
    async (payload: PrimePlaybackPayload) => {
      const queue = getPlayQueue();
      const tracks = payload.queue ?? [payload.track];
      const startIndex = payload.startIndex ?? 0;

      queue.setQueue(tracks, startIndex);
      setQueueState(queue.getState());

      if (payload.context) {
        getPlayContext().setContext(payload.context);
      }

      // Prepare track with preloader before priming
      const playableTrack = await prepareTrack(payload.track);
      getAudioPlayer().prime(playableTrack);
      preloadUpcomingTrack();
      setPlayerState(getAudioPlayer().getState());
      persistProgress(0);
    },
    [persistProgress, prepareTrack, preloadUpcomingTrack]
  );

  /**
   * Refresh current playlist queue
   * Used when songs are added/removed from the current playing playlist
   */
  const refreshCurrentPlaylistQueue = useCallback(
    async (playlistId: string) => {
      const context = getPlayContext().getContext();

      // Only refresh if we're currently playing from this playlist
      if (!context || context.type !== 'playlist' || context.id !== playlistId) {
        return;
      }

      try {
        const currentTrack = playerState.currentTrack;
        if (!currentTrack) return;

        // Fetch updated playlist songs
        const songs = await api.main.playlists.getSongs(playlistId);

        if (!songs) {
          logger.warn('Failed to refresh playlist queue', { playlistId });
          return;
        }

        const tracks: Track[] = songs.map((song) => ({
          id: song.id,
          title: song.title,
          artist: song.artist ?? undefined,
          album: song.album ?? undefined,
          coverUrl: song.coverUrl ?? undefined,
          duration: song.duration ?? undefined,
          audioUrl: MAIN_API_ENDPOINTS.songs.stream(song.id),
          mimeType: song.mimeType ?? 'audio/mpeg',
        }));

        // Find current track index in new queue
        const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);

        if (currentIndex === -1) {
          // Current track was removed from playlist, keep playing but clear queue
          logger.info('Current track removed from playlist, keeping playback but clearing context');
          return;
        }

        // Update queue with new tracks, preserving current playback
        const queue = getPlayQueue();
        queue.setQueue(tracks, currentIndex);
        setQueueState(queue.getState());

        logger.info('Refreshed playlist queue', {
          playlistId,
          trackCount: tracks.length,
          currentIndex
        });
      } catch (error) {
        logger.error('Failed to refresh playlist queue', { error, playlistId });
      }
    },
    [playerState.currentTrack]
  );

  const trackedSongId = playerState.currentTrack?.id;
  const isPlaying = playerState.isPlaying;

  useEffect(() => {
    if (!trackedSongId) {
      return;
    }

    // Persist on mount and when track changes
    persistProgress();

    if (!isPlaying) {
      return;
    }

    // Auto-save progress every 5 seconds while playing
    const interval = setInterval(() => {
      persistProgress();
    }, 5000);

    return () => {
      clearInterval(interval);
      // Persist one last time on cleanup (debounced to avoid duplicates)
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
    refreshCurrentPlaylistQueue,
  };
}
