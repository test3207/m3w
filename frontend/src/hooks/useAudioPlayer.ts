/**
 * Audio Player React Hook
 * Provides audio player state and controls to React components
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getAudioPlayer, type PlayerState, type Track } from "@/lib/audio/player";
import { getPlayQueue, RepeatMode } from "@/lib/audio/queue";
import { getPlayContext, type PlayContext } from "@/lib/audio/context";
import { useTrackPreloader } from "@/hooks/useTrackPreloader";
import { logger } from "@/lib/logger-client";
import { api } from "@/services";
import {
  songsToTracks,
  loadFullQueueForTrack,
  setupQueueWithContext,
} from "@/lib/audio/track-loader";
import { buildCoverUrl, buildStreamUrl } from "@/lib/utils/url";
import type { PlayContextType } from "@/lib/audio/context";

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
  const { prepareTrack, preloadNextInQueue } = useTrackPreloader(MAX_PRELOADED_TRACKS);

  // Initialize preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await api.main.player.getPreferences();
        if (preferences) {
          const queue = getPlayQueue();
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
        logger.error("Failed to load playback preferences", error);
      }
    };
    void loadPreferences();
  }, []);

  // Initialize playback state
  useEffect(() => {
    let isMounted = true;

    const primeTrackFromData = async (
      track: Track,
      context?: { type?: string; id?: string; name?: string },
      position?: number
    ) => {
      const { tracks, currentIndex } = await loadFullQueueForTrack(track, context);
      const playContext = (context?.type && context?.id) 
        ? { type: context.type as PlayContextType, id: context.id, name: context.name ?? "" }
        : undefined;
      setupQueueWithContext(tracks, currentIndex, playContext);

      if (position !== undefined) {
        resumeProgressRef.current = { trackId: track.id, position };
        getAudioPlayer().setPendingSeek(position);
      }

      const playableTrack = await prepareTrack(track);
      getAudioPlayer().prime(playableTrack);

      if (isMounted) {
        const snapshot = getAudioPlayer().getState();
        setPlayerState({
          ...snapshot,
          currentTrack: track,
          currentTime: position ?? 0,
          duration: track.duration ?? snapshot.duration,
          isPlaying: false,
        });
      }
    };

    const loadInitialPlaybackState = async () => {
      if (isInitializing) {
        await initializationPromise;
        return;
      }

      isInitializing = true;
      initializationPromise = (async () => {
        try {
          // Try to load progress first
          const progress = await api.main.player.getProgress();
          logger.info("Loaded playback progress", { hasProgress: !!progress, trackId: progress?.track?.id });

          if (progress?.track) {
            const track: Track = {
              id: progress.track.id,
              title: progress.track.title,
              artist: progress.track.artist ?? undefined,
              album: progress.track.album ?? undefined,
              coverUrl: buildCoverUrl(progress.track.id) ?? undefined,
              duration: progress.track.duration ?? undefined,
              audioUrl: buildStreamUrl(progress.track.id),
              mimeType: progress.track.mimeType ?? undefined,
            };
            await primeTrackFromData(track, progress.context ?? undefined, progress.position);
            return;
          }

          // Fallback to seed
          const seed = await api.main.player.getSeed();
          logger.info("Loaded default seed", { hasSeed: !!seed, trackId: seed?.track?.id });

          if (seed?.track) {
            const track: Track = {
              id: seed.track.id,
              title: seed.track.title,
              artist: seed.track.artist ?? undefined,
              album: seed.track.album ?? undefined,
              coverUrl: buildCoverUrl(seed.track.id) ?? undefined,
              duration: seed.track.duration ?? undefined,
              audioUrl: buildStreamUrl(seed.track.id),
              mimeType: seed.track.mimeType ?? undefined,
            };
            await primeTrackFromData(track, seed.context);
          }
        } catch (error) {
          logger.error("Failed to load initial playback state", error);
        } finally {
          isInitializing = false;
          initializationPromise = null;
        }
      })();

      await initializationPromise;
    };

    void loadInitialPlaybackState();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistPreferences = useCallback(
    (preferences: Partial<{ shuffleEnabled: boolean; repeatMode: RepeatMode }>) => {
      void api.main.player.updatePreferences(preferences).catch((error: unknown) => {
        logger.error("Failed to persist playback preferences", error);
      });
    },
    []
  );

  const persistProgress = useCallback((positionOverride?: number) => {
    const state = getAudioPlayer().getState();
    const track = state.currentTrack;
    if (!track) return;

    const context = getPlayContext().getContext();
    const position = Math.max(0, Math.min(86_400, Math.round(positionOverride ?? state.currentTime)));

    // Debounce: skip if same track and position persisted within last 500ms
    const now = Date.now();
    const last = lastProgressPersistRef.current;
    if (last && last.trackId === track.id && last.position === position && now - last.timestamp < 500) {
      return;
    }

    lastProgressPersistRef.current = { trackId: track.id, position, timestamp: now };

    void api.main.player.updateProgress({
      songId: track.id,
      position,
      contextType: (context?.type === "library" || context?.type === "playlist") ? context.type : undefined,
      contextId: context?.id,
      contextName: context?.name,
    }).catch((error: unknown) => {
      logger.error("Failed to persist playback progress", error);
    });
  }, []);

  const applyResumeProgress = useCallback((trackId: string): number | null => {
    const pending = resumeProgressRef.current;
    if (!pending || pending.trackId !== trackId) return null;

    resumeProgressRef.current = null;
    const player = getAudioPlayer();
    player.setPendingSeek(pending.position);
    const state = player.getState();
    if (state.isPlaying) {
      player.seek(pending.position);
    }
    setPlayerState((prev) => ({ ...prev, currentTime: pending.position }));
    return pending.position;
  }, []);

  const preloadUpcomingTrack = useCallback(() => {
    const queue = getPlayQueue();
    const state = queue.getState();
    preloadNextInQueue(state.tracks, state.currentIndex);
  }, [preloadNextInQueue]);

  const playWithPreload = useCallback(async (track: Track) => {
    const playableTrack = await prepareTrack(track);
    await getAudioPlayer().play(playableTrack);
    const applied = applyResumeProgress(track.id);
    persistProgress(applied ?? 0);
    preloadUpcomingTrack();
  }, [prepareTrack, applyResumeProgress, persistProgress, preloadUpcomingTrack]);

  const handleTrackEnd = useCallback((state: PlayerState) => {
    setPlayerState(state);
    const queue = getPlayQueue();
    const nextTrack = queue.next();
    setQueueState(queue.getState());
    if (nextTrack) {
      void playWithPreload(nextTrack).catch((error) => {
        logger.error("Failed to auto-play next track", error);
      });
    }
  }, [playWithPreload]);

  // Subscribe to player events
  useEffect(() => {
    const player = getAudioPlayer();
    const unsubscribers = [
      player.on("play", setPlayerState),
      player.on("pause", setPlayerState),
      player.on("end", handleTrackEnd),
      player.on("load", setPlayerState),
      player.on("seek", setPlayerState),
      player.on("volume", setPlayerState),
      player.on("error", setPlayerState),
    ];
    return () => { unsubscribers.forEach(u => u()); };
  }, [handleTrackEnd]);

  // Preload next track when queue changes
  useEffect(() => {
    preloadUpcomingTrack();
  }, [queueState.currentIndex, queueState.tracks, preloadUpcomingTrack]);

  const play = useCallback(async (track: Track) => {
    await playWithPreload(track);
  }, [playWithPreload]);

  const playFromQueue = useCallback(
    async (tracks: Track[], startIndex = 0, context?: PlayContext) => {
      logger.info("playFromQueue called", { tracksCount: tracks.length, startIndex, context });
      const queue = getPlayQueue();
      queue.setQueue(tracks, startIndex);
      setQueueState(queue.getState());
      const track = queue.getCurrentTrack();
      if (track) {
        if (context) getPlayContext().setContext(context);
        await playWithPreload(track);
      } else {
        logger.warn("No track to play from queue");
      }
    },
    [playWithPreload]
  );

  const pause = useCallback(() => { getAudioPlayer().pause(); }, []);

  const resume = useCallback(() => {
    const currentTrack = getAudioPlayer().getState().currentTrack;
    const applied = currentTrack ? applyResumeProgress(currentTrack.id) : null;
    getAudioPlayer().resume();
    if (applied !== null) persistProgress(applied);
  }, [applyResumeProgress, persistProgress]);

  const togglePlay = useCallback(() => {
    if (playerState.isPlaying) getAudioPlayer().pause();
    else resume();
  }, [playerState.isPlaying, resume]);

  const next = useCallback(async () => {
    const queue = getPlayQueue();
    const nextTrack = queue.next();
    if (nextTrack) await playWithPreload(nextTrack);
    setQueueState(queue.getState());
  }, [playWithPreload]);

  const previous = useCallback(async () => {
    const queue = getPlayQueue();
    const prevTrack = queue.previous();
    if (prevTrack) await playWithPreload(prevTrack);
    setQueueState(queue.getState());
  }, [playWithPreload]);

  const seek = useCallback((position: number) => {
    getAudioPlayer().seek(position);
    persistProgress(position);
  }, [persistProgress]);

  const setVolume = useCallback((volume: number) => { getAudioPlayer().setVolume(volume); }, []);

  const toggleMute = useCallback(() => {
    getAudioPlayer().setMuted(!playerState.isMuted);
  }, [playerState.isMuted]);

  const toggleShuffle = useCallback(() => {
    const queue = getPlayQueue();
    const enabled = queue.toggleShuffle();
    setPlayerState(getAudioPlayer().getState());
    setQueueState(queue.getState());
    persistPreferences({ shuffleEnabled: enabled });
    return enabled;
  }, [persistPreferences]);

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
      if (payload.context) getPlayContext().setContext(payload.context);
      const playableTrack = await prepareTrack(payload.track);
      getAudioPlayer().prime(playableTrack);
      preloadUpcomingTrack();
      setPlayerState(getAudioPlayer().getState());
      persistProgress(0);
    },
    [persistProgress, prepareTrack, preloadUpcomingTrack]
  );

  const refreshCurrentPlaylistQueue = useCallback(
    async (playlistId: string) => {
      const context = getPlayContext().getContext();
      if (!context || context.type !== "playlist" || context.id !== playlistId) return;

      try {
        const currentTrack = playerState.currentTrack;
        if (!currentTrack) return;

        const songs = await api.main.playlists.getSongs(playlistId);
        if (!songs) {
          logger.warn("Failed to refresh playlist queue", { playlistId });
          return;
        }

        const tracks = songsToTracks(songs);
        const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
        if (currentIndex === -1) {
          logger.info("Current track removed from playlist");
          return;
        }

        const queue = getPlayQueue();
        queue.setQueue(tracks, currentIndex);
        setQueueState(queue.getState());
        logger.info("Refreshed playlist queue", { playlistId, trackCount: tracks.length, currentIndex });
      } catch (error) {
        logger.error("Failed to refresh playlist queue", { error, playlistId });
      }
    },
    [playerState.currentTrack]
  );

  // Auto-save progress
  const trackedSongId = playerState.currentTrack?.id;
  const isPlaying = playerState.isPlaying;

  useEffect(() => {
    if (!trackedSongId) return;
    persistProgress();
    if (!isPlaying) return;

    const interval = setInterval(() => { persistProgress(); }, 5000);
    return () => {
      clearInterval(interval);
      persistProgress();
    };
  }, [trackedSongId, isPlaying, persistProgress]);

  return {
    ...playerState,
    queueState,
    playContext: getPlayContext().getContext(),
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
