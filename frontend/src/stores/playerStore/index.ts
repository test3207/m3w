import { create } from "zustand";
import { api } from "@/services";
import { logger } from "@/lib/logger-client";
import { getAudioPlayer } from "@/lib/audio/player";
import { prefetchAudioBlob } from "@/lib/audio/prefetch";
import {
  updateMediaSessionPositionState,
  clearMediaSessionMetadata,
} from "@/lib/audio/media-session";
import { RepeatMode } from "@m3w/shared";
import { I18n } from "@/locales/i18n";
import { isOfflineAuthUser } from "@/stores/authStore";
import { isSongCached } from "@/lib/storage/audio-cache";
import { toast } from "@/components/ui/use-toast";

// Import from same module (playerStore/)
import type { PlayerStore, QueueSource } from "./types";
import {
  findNextPlayableSong,
  findPreviousPlayableSong,
  songToTrack,
  updateMediaSessionForSong,
  prepareAndPlaySong,
} from "./helpers";
import {
  getBackupState,
  setBackupState,
  isListenersRegistered,
  markListenersRegistered,
} from "./hmr-support";
import {
  apiTrackToSong,
  loadPreferences,
  loadDefaultSeed,
  loadQueueFromContext,
  primePlayerWithSong,
} from "./persistence";
import { initializeEventHandlers } from "./event-handlers";

// Re-export types for consumers
export type { QueueSource, PlayerState, PlayerActions, PlayerStore } from "./types";

export const usePlayerStore = create<PlayerStore>((set, get) => {
  // Get AudioPlayer instance
  const audioPlayer = getAudioPlayer();

  const backupState = getBackupState();
  const audioState = audioPlayer.getState();

  return {
    // Initial state (restore from backup if HMR, otherwise start fresh)
    currentSong: backupState?.currentSong ?? null,
    lastPlayedSong: backupState?.lastPlayedSong ?? null,
    queue: backupState?.queue ?? [],
    currentIndex: backupState?.currentIndex ?? -1,
    queueSource: backupState?.queueSource ?? null,
    queueSourceId: backupState?.queueSourceId ?? null,
    queueSourceName: backupState?.queueSourceName ?? null,
    isPlaying: audioState.isPlaying, // Always use AudioPlayer's actual state
    volume: backupState?.volume ?? 0.8,
    isMuted: backupState?.isMuted ?? false,
    repeatMode: backupState?.repeatMode ?? RepeatMode.Off,
    isShuffled: backupState?.isShuffled ?? false,
    currentTime: backupState?.currentTime ?? 0,
    duration: backupState?.duration ?? 0,
    hasLoadedPreferences: backupState?.hasLoadedPreferences ?? false,
    hasUserModifiedPreferences: backupState?.hasUserModifiedPreferences ?? false,

    // Playback control
    play: (song) => {
      if (song) {
        const track = songToTrack(song);
        audioPlayer.play(track);
        set({ currentSong: song, lastPlayedSong: song, isPlaying: true });
        // Update Media Session metadata for lock screen display
        updateMediaSessionForSong(song);
        logger.info("Playing song", { songId: song.id, title: song.title });
      } else {
        // Resume playback and ensure Media Session metadata is restored
        // (may have been cleared by browser during background/sleep)
        const { currentSong, duration, currentTime } = get();
        if (currentSong) {
          updateMediaSessionForSong(currentSong);
          if (isFinite(currentTime) && isFinite(duration) && duration > 0) {
            updateMediaSessionPositionState(currentTime, duration);
          }
        }
        audioPlayer.resume();
        set({ isPlaying: true });
      }
    },

    pause: () => {
      audioPlayer.pause();
      // isPlaying state will be set by AudioPlayer 'pause' event
    },

    togglePlayPause: () => {
      const { isPlaying, currentSong } = get();
      if (isPlaying) {
        audioPlayer.pause();
        // isPlaying state will be set by AudioPlayer 'pause' event
      } else {
        if (currentSong) {
          audioPlayer.resume();
          // isPlaying state will be set by AudioPlayer 'play' event
          // If resume fails, 'error' event will handle the state
        }
      }
    },

    stop: () => {
      audioPlayer.stop();
      // Clear Media Session when stopping playback
      clearMediaSessionMetadata();
      set({
        isPlaying: false,
        currentTime: 0,
      });
    },

    // Queue management
    setQueue: (songs, startIndex = 0) =>
      set((state) => ({
        queue: songs,
        currentIndex: startIndex,
        currentSong: songs[startIndex] || null,
        lastPlayedSong: songs[startIndex] || state.lastPlayedSong,
      })),

    addToQueue: (song) =>
      set((state) => ({
        queue: [...state.queue, song],
      })),

    removeFromQueue: (index) =>
      set((state) => {
        const newQueue = state.queue.filter((_, i) => i !== index);
        let newIndex = state.currentIndex;

        if (index < state.currentIndex) {
          newIndex--;
        } else if (index === state.currentIndex) {
          newIndex = Math.min(newIndex, newQueue.length - 1);
        }

        return {
          queue: newQueue,
          currentIndex: newIndex,
          currentSong: newQueue[newIndex] || null,
          lastPlayedSong: newQueue[newIndex] || state.lastPlayedSong,
        };
      }),

    clearQueue: () => {
      // Stop audio playback
      const audioPlayer = getAudioPlayer();
      audioPlayer.stop();
      // Clear Media Session when clearing queue
      clearMediaSessionMetadata();

      return set({
        queue: [],
        currentIndex: -1,
        currentSong: null,
        isPlaying: false,
        queueSource: null,
        queueSourceId: null,
        queueSourceName: null,
      });
    },

    // Queue source management
    setQueueSource: (source, sourceId, sourceName) =>
      set({
        queueSource: source,
        queueSourceId: sourceId,
        queueSourceName: sourceName,
      }),

    playFromLibrary: async (libraryId, libraryName, songs, startIndex = 0) => {
      const currentSong = songs[startIndex];
      if (!currentSong) {
        logger.warn("No song at start index", { startIndex, songCount: songs.length });
        return;
      }

      // Create or update library's "Play All" playlist
      try {
        const playlistName = `${libraryName} - ${I18n.libraries.detail.playAll}`;
        const songIds = songs.map(s => s.id);

        // Try to find existing playlist for this library
        const existingPlaylist = await api.main.playlists.getByLibrary(libraryId);

        let playlistId: string;
        if (existingPlaylist) {
          // Update existing playlist
          await api.main.playlists.updateSongs(existingPlaylist.id, { songIds });
          playlistId = existingPlaylist.id;
          logger.info("Updated library playlist", { playlistId, songCount: songIds.length });
        } else {
          // Create new playlist linked to library
          const newPlaylist = await api.main.playlists.createForLibrary({
            name: playlistName,
            linkedLibraryId: libraryId,
            songIds,
          });
          playlistId = newPlaylist.id;
          logger.info("Created library playlist", { playlistId, libraryId });
        }

        // Now play from this playlist
        get().playFromPlaylist(playlistId, playlistName, songs, startIndex);

      } catch (error) {
        logger.error("Failed to create/update library playlist", { error, libraryId });

        // Fallback: play without saving playlist
        const track = songToTrack(currentSong);
        const resolvedUrl = await prefetchAudioBlob(track.audioUrl);
        const preparedTrack = resolvedUrl ? { ...track, resolvedUrl } : track;

        audioPlayer.play(preparedTrack);
        // Update Media Session metadata for the song
        updateMediaSessionForSong(currentSong);

        set({
          queue: songs,
          currentIndex: startIndex,
          currentSong,
          queueSource: "library",
          queueSourceId: libraryId,
          queueSourceName: libraryName,
          isPlaying: true,
        });
      }
    },

    playFromPlaylist: async (playlistId, playlistName, songs, startIndex = 0) => {
      const currentRepeatMode = get().repeatMode;

      logger.info("playFromPlaylist called", {
        playlistId,
        playlistName,
        songCount: songs.length,
        startIndex,
        currentRepeatMode
      });

      const currentSong = songs[startIndex];
      if (!currentSong) {
        logger.warn("No song at start index", { startIndex, songCount: songs.length });
        return;
      }

      // Convert song to track and prefetch
      const track = songToTrack(currentSong);
      const resolvedUrl = await prefetchAudioBlob(track.audioUrl);
      const preparedTrack = resolvedUrl ? { ...track, resolvedUrl } : track;

      // Play the prepared track
      audioPlayer.play(preparedTrack);
      // Update Media Session metadata for lock screen display
      updateMediaSessionForSong(currentSong);

      set({
        queue: songs,
        currentIndex: startIndex,
        currentSong,
        queueSource: "playlist",
        queueSourceId: playlistId,
        queueSourceName: playlistName,
        isPlaying: true,
        // Preserve repeatMode and isShuffled
        repeatMode: currentRepeatMode,
      });

      logger.info("Playing from playlist", {
        playlistId,
        playlistName,
        songCount: songs.length,
        startIndex,
        songTitle: currentSong.title
      });
    },

    saveQueueAsPlaylist: async (name: string) => {
      const { queue } = get();

      if (queue.length === 0) {
        logger.warn("Cannot save empty queue as playlist");
        return false;
      }

      try {
        const songIds = queue.map((song) => song.id);
        const newPlaylist = await api.main.playlists.create({ name });

        // Add songs in order
        for (const songId of songIds) {
          await api.main.playlists.addSong(newPlaylist.id, { songId });
        }

        logger.info("Saved queue as playlist", { playlistName: name, songCount: songIds.length });
        return true;
      } catch (error) {
        logger.error("Failed to save queue as playlist", { error, name });
        return false;
      }
    },

    // Navigation
    next: async () => {
      const state = get();
      const { queue, currentIndex } = state;

      if (queue.length === 0) return;

      // Check if we're an Auth user offline (need to skip uncached songs)
      const shouldSkipUncached = isOfflineAuthUser();

      let targetIndex: number;

      // Manual "next" button always loops (ignore repeat mode)
      // Repeat mode only affects automatic playback on track end
      if (currentIndex < queue.length - 1) {
        targetIndex = currentIndex + 1;
      } else {
        targetIndex = 0;
      }

      // Find next playable song (may skip uncached songs when offline)
      const result = await findNextPlayableSong(queue, targetIndex, shouldSkipUncached);

      if (!result) {
        toast({
          title: I18n.player.noCachedSongs,
          variant: "destructive",
        });
        set({ isPlaying: false });
        return;
      }

      const { nextIndex, skippedCount } = result;

      if (skippedCount > 0) {
        toast({
          title: I18n.player.skippedUncachedSongs.replace("{0}", String(skippedCount)),
        });
      }

      const nextSong = queue[nextIndex];
      if (nextSong) {
        await prepareAndPlaySong(nextSong, nextIndex, audioPlayer, set);
      }
    },

    previous: async () => {
      const { queue, currentIndex, currentTime } = get();

      if (queue.length === 0) return;

      // If more than 3 seconds played, restart current song
      if (currentTime > 3) {
        audioPlayer.seek(0);
        set({ currentTime: 0 });
        return;
      }

      // Check if we're an Auth user offline (need to skip uncached songs)
      const shouldSkipUncached = isOfflineAuthUser();

      const targetIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;

      // Find previous playable song (may skip uncached songs when offline)
      const result = await findPreviousPlayableSong(queue, targetIndex, shouldSkipUncached);

      if (!result) {
        toast({
          title: I18n.player.noCachedSongs,
          variant: "destructive",
        });
        set({ isPlaying: false });
        return;
      }

      const { prevIndex, skippedCount } = result;

      if (skippedCount > 0) {
        toast({
          title: I18n.player.skippedUncachedSongs.replace("{0}", String(skippedCount)),
        });
      }

      const prevSong = queue[prevIndex];
      if (prevSong) {
        await prepareAndPlaySong(prevSong, prevIndex, audioPlayer, set);
      }
    },

    seekTo: async (index) => {
      const { queue } = get();

      if (index < 0 || index >= queue.length) return;

      const song = queue[index];
      if (!song) return;

      // If offline Auth user and song not cached, show error
      if (isOfflineAuthUser() && !(await isSongCached(song.id))) {
        toast({
          title: I18n.player.songNotCached,
          variant: "destructive",
        });
        return;
      }

      await prepareAndPlaySong(song, index, audioPlayer, set);
    },

    seek: (time) => {
      audioPlayer.seek(time);
      set({ currentTime: time });
    },

    // Audio settings
    setVolume: (volume) =>
      set({
        volume: Math.max(0, Math.min(1, volume)),
        isMuted: volume === 0,
      }),

    toggleMute: () =>
      set((state) => ({
        isMuted: !state.isMuted,
      })),

    setRepeatMode: async (mode) => {
      set({ repeatMode: mode, hasUserModifiedPreferences: true });

      try {
        await api.main.player.updatePreferences({ repeatMode: mode });
        logger.info("Saved repeat mode preference", { repeatMode: mode });
      } catch (error) {
        logger.error("Failed to save repeat mode preference", error);
      }
    },

    toggleRepeat: () => {
      const state = get();
      const modes: RepeatMode[] = [RepeatMode.Off, RepeatMode.All, RepeatMode.One];
      const currentIndex = modes.indexOf(state.repeatMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      const nextMode = modes[nextIndex];

      logger.info("Toggle repeat mode", {
        from: state.repeatMode,
        to: nextMode,
        currentIndex,
        nextIndex
      });

      // Save to backend (async, don't wait)
      get().setRepeatMode(nextMode);
    },

    toggleShuffle: async () => {
      const state = get();
      const newShuffled = !state.isShuffled;

      if (newShuffled && state.queue.length > 0) {
        // Shuffle queue (keep current song at current index)
        const shuffled = [...state.queue];
        const currentSong = shuffled[state.currentIndex];

        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Move current song back to current index
        const newCurrentIndex = shuffled.indexOf(currentSong);
        if (newCurrentIndex !== state.currentIndex && newCurrentIndex !== -1) {
          [shuffled[state.currentIndex], shuffled[newCurrentIndex]] = [
            shuffled[newCurrentIndex],
            shuffled[state.currentIndex],
          ];
        }

        set({ isShuffled: newShuffled, queue: shuffled, hasUserModifiedPreferences: true });
      } else {
        set({ isShuffled: newShuffled, hasUserModifiedPreferences: true });
      }

      // Save to backend (async, don't wait)
      try {
        await api.main.player.updatePreferences({ shuffleEnabled: newShuffled });
        logger.info("Saved shuffle preference", { shuffleEnabled: newShuffled });
      } catch (error) {
        logger.error("Failed to save shuffle preference", error);
      }
    },

    // Progress
    setCurrentTime: (time) => set({ currentTime: time }),

    setDuration: (duration) => set({ duration }),

    // Initialization & Persistence
    loadPlaybackProgress: async () => {
      try {
        logger.info("Loading playback progress...");

        // Load playback preferences (repeat mode and shuffle)
        const { hasUserModifiedPreferences } = get();
        await loadPreferences(hasUserModifiedPreferences, set);

        const progress = await api.main.player.getProgress();

        if (!progress?.track) {
          logger.info("No playback progress found, trying seed...");
          await loadDefaultSeed(set);
          return;
        }

        logger.info("Found playback progress", {
          trackId: progress.track.id,
          position: progress.position,
          context: progress.context
        });

        // Convert API track to Song
        const song = apiTrackToSong(progress.track);

        // Load full queue based on context
        const { queue: contextQueue, startIndex: contextStartIndex } = await loadQueueFromContext(
          progress.context ?? undefined,
          song.id
        );
        const fullQueue = contextQueue.length > 0 ? contextQueue : [song];
        const startIndex = contextQueue.length > 0 ? contextStartIndex : 0;

        // Update store state
        set({
          currentSong: song,
          lastPlayedSong: song,
          queue: fullQueue,
          currentIndex: startIndex,
          queueSource: progress.context?.type as QueueSource ?? null,
          queueSourceId: progress.context?.id ?? null,
          queueSourceName: progress.context?.name ?? null,
          currentTime: progress.position,
          isPlaying: false, // Don't auto-play
        });

        // Preload audio and prime player
        await primePlayerWithSong(song, progress.position, fullQueue.length);
      } catch (error) {
        logger.error("Failed to load playback progress", error);
      }
    },

    savePlaybackProgress: () => {
      const { currentSong, currentTime, queueSource, queueSourceId, queueSourceName } = get();

      if (!currentSong) {
        return;
      }

      const contextType = (queueSource === "library" || queueSource === "playlist")
        ? queueSource
        : undefined;

      api.main.player.updateProgress({
        songId: currentSong.id,
        position: Math.round(currentTime),
        contextType,
        contextId: queueSourceId ?? undefined,
        contextName: queueSourceName ?? undefined,
      })
        .then(() => {
          logger.info("Saved playback progress", {
            songId: currentSong.id,
            position: Math.round(currentTime)
          });
        })
        .catch((error) => {
          logger.error("Failed to save playback progress", error);
        });
    },

    savePlaybackProgressSync: () => {
      const { currentSong, currentTime, queueSource, queueSourceId, queueSourceName } = get();

      if (!currentSong) {
        return;
      }

      const contextType = (queueSource === "library" || queueSource === "playlist")
        ? queueSource
        : undefined;

      const data = {
        songId: currentSong.id,
        position: Math.round(currentTime),
        contextType,
        contextId: queueSourceId ?? undefined,
        contextName: queueSourceName ?? undefined,
      };

      // Use fetch with keepalive for page unload (allows PUT method unlike sendBeacon)
      // keepalive ensures request completes even if page is already closing
      void api.main.player.updateProgress(data, { keepalive: true }).catch((err) => {
        // Log error but can't handle it during page unload
        logger.error("Failed to send playback progress with keepalive", err);
      });

      logger.info("Sent playback progress with keepalive", {
        songId: currentSong.id,
        position: Math.round(currentTime)
      });
    },
  };
});

// Setup event listeners and Media Session handlers (only once)
// Must be after create() since we reference usePlayerStore
if (!isListenersRegistered()) {
  markListenersRegistered();
  initializeEventHandlers(usePlayerStore.getState, usePlayerStore.setState);
}

// Save state for HMR (development only)
if (import.meta.env.DEV) {
  usePlayerStore.subscribe(({
    currentSong, lastPlayedSong, queue, currentIndex,
    queueSource, queueSourceId, queueSourceName,
    isPlaying, volume, isMuted, repeatMode, isShuffled,
    currentTime, duration, hasLoadedPreferences, hasUserModifiedPreferences,
  }) => {
    setBackupState({
      currentSong, lastPlayedSong, queue, currentIndex,
      queueSource, queueSourceId, queueSourceName,
      isPlaying, volume, isMuted, repeatMode, isShuffled,
      currentTime, duration, hasLoadedPreferences, hasUserModifiedPreferences,
    });
  });
}
