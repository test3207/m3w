import { create } from 'zustand';
import { api } from '@/services';
import { logger } from '@/lib/logger-client';
import { getAudioPlayer, type Track } from '@/lib/audio/player';
import { prefetchAudioBlob } from '@/lib/audio/prefetch';
import {
  registerMediaSessionHandlers,
  updateMediaSessionMetadata,
  updateMediaSessionPlaybackState,
  updateMediaSessionPositionState,
  clearMediaSessionMetadata,
} from '@/lib/audio/media-session';
import type { Song } from '@m3w/shared';
import { getStreamUrl } from '@/services/api/main/endpoints';
import { I18n } from '@/locales/i18n';

export type RepeatMode = 'off' | 'one' | 'all';
export type QueueSource = 'library' | 'playlist' | 'all' | null;

// Store previous state for HMR (use window to survive HMR)
declare global {
  interface Window {
    __PLAYER_STATE_BACKUP__?: PlayerState;
  }
}

const getBackupState = (): PlayerState | null => {
  return window.__PLAYER_STATE_BACKUP__ || null;
};

const setBackupState = (state: PlayerState) => {
  window.__PLAYER_STATE_BACKUP__ = state;
};

// Song → Track converter for AudioPlayer
function songToTrack(song: Song): Track {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist || undefined,
    album: song.album || undefined,
    coverUrl: song.coverUrl || undefined,
    duration: song.duration || undefined,
    mimeType: song.mimeType || undefined,
    audioUrl: getStreamUrl(song.id),
  };
}

// Update Media Session with current song info
function updateMediaSessionForSong(song: Song | null): void {
  if (!song) {
    clearMediaSessionMetadata();
    return;
  }

  updateMediaSessionMetadata({
    title: song.title,
    artist: song.artist ?? undefined,
    album: song.album ?? undefined,
    coverUrl: song.coverUrl ?? undefined,
    duration: song.duration ?? undefined,
  });

  // Initialize position state with duration if available
  if (typeof song.duration === 'number' && song.duration > 0) {
    updateMediaSessionPositionState(0, song.duration);
  }
}

interface PlayerState {
  // Current playback
  currentSong: Song | null;
  queue: Song[];
  currentIndex: number;
  
  // Queue source tracking
  queueSource: QueueSource;
  queueSourceId: string | null; // Library ID or Playlist ID
  queueSourceName: string | null; // Display name
  
  // Playback state
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  
  // Progress
  currentTime: number;
  duration: number;
  
  // Preference loading tracking (prevent race condition)
  hasLoadedPreferences: boolean;
  hasUserModifiedPreferences: boolean;
}

interface PlayerActions {
  // Playback control
  play: (song?: Song) => void;
  pause: () => void;
  togglePlayPause: () => void;
  stop: () => void;
  
  // Queue management
  setQueue: (songs: Song[], startIndex?: number) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  
  // Queue source management
  setQueueSource: (source: QueueSource, sourceId: string | null, sourceName: string | null) => void;
  playFromLibrary: (libraryId: string, libraryName: string, songs: Song[], startIndex?: number) => Promise<void>;
  playFromPlaylist: (playlistId: string, playlistName: string, songs: Song[], startIndex?: number) => void;
  saveQueueAsPlaylist: (name: string) => Promise<boolean>;
  
  // Navigation
  next: () => void;
  previous: () => void;
  seekTo: (index: number) => void;
  seek: (time: number) => void;
  
  // Audio settings
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRepeatMode: (mode: RepeatMode) => Promise<void>;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  
  // Progress
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  
  // Initialization & Persistence
  loadPlaybackProgress: () => Promise<void>;
  savePlaybackProgress: () => void;
  savePlaybackProgressSync: () => void; // Synchronous save using fetch with keepalive: true for page unload
}

type PlayerStore = PlayerState & PlayerActions;

export const usePlayerStore = create<PlayerStore>((set, get) => {
  // Get AudioPlayer instance
  const audioPlayer = getAudioPlayer();
  
  // Register Media Session handlers for lock screen controls
  // Note: We register handlers once at store creation. The handlers use get()
  // to access current state, so they always reflect the latest queue/position.
  registerMediaSessionHandlers({
    onPlay: () => {
      const { currentSong, duration, currentTime } = get();
      if (currentSong) {
        // Refresh metadata in case it was cleared (reuse helper function)
        updateMediaSessionForSong(currentSong);
        // Also update position state when resuming (if valid)
        if (isFinite(currentTime) && isFinite(duration) && duration > 0) {
          updateMediaSessionPositionState(currentTime, duration);
        }
        audioPlayer.resume();
      }
    },
    onPause: () => {
      audioPlayer.pause();
    },
    onPreviousTrack: () => {
      // Use get() to call the store's previous() action
      get().previous();
    },
    onNextTrack: () => {
      // Use get() to call the store's next() action
      get().next();
    },
    onSeekTo: (time: number) => {
      const { duration } = get();
      // Validate inputs before seeking
      if (!isFinite(time) || !isFinite(duration) || duration <= 0) return;
      const clampedTime = Math.max(0, Math.min(time, duration));
      audioPlayer.seek(clampedTime);
      set({ currentTime: clampedTime });
      updateMediaSessionPositionState(clampedTime, duration);
    },
    onSeekBackward: (offset: number) => {
      const { currentTime, duration } = get();
      // Validate all inputs before seeking
      if (!isFinite(offset) || offset <= 0) return;
      if (!isFinite(currentTime) || !isFinite(duration) || duration <= 0) return;
      const newTime = Math.max(0, currentTime - offset);
      audioPlayer.seek(newTime);
      set({ currentTime: newTime });
      updateMediaSessionPositionState(newTime, duration);
    },
    onSeekForward: (offset: number) => {
      const { currentTime, duration } = get();
      // Validate all inputs before seeking
      if (!isFinite(offset) || offset <= 0) return;
      if (!isFinite(currentTime) || !isFinite(duration) || duration <= 0) return;
      const newTime = Math.min(duration, currentTime + offset);
      audioPlayer.seek(newTime);
      set({ currentTime: newTime });
      updateMediaSessionPositionState(newTime, duration);
    },
  });
  
  // Setup event listeners for AudioPlayer state changes
  audioPlayer.on('play', (state) => {
    set({ isPlaying: true, currentTime: state.currentTime, duration: state.duration });
    updateMediaSessionPlaybackState('playing');
    logger.info('AudioPlayer playing');
  });

  audioPlayer.on('pause', (state) => {
    set({ isPlaying: false, currentTime: state.currentTime });
    updateMediaSessionPlaybackState('paused');
    // Update position state to ensure lock screen reflects current position
    updateMediaSessionPositionState(state.currentTime, state.duration);
    logger.info('AudioPlayer paused');
  });

  audioPlayer.on('end', async () => {
    const { next, repeatMode } = get();
    logger.info('Track ended, repeatMode:', repeatMode);
    
    if (repeatMode === 'one') {
      // Replay current track
      const { currentSong } = get();
      if (currentSong) {
        const track = songToTrack(currentSong);
        const resolvedUrl = await prefetchAudioBlob(track.audioUrl);
        const preparedTrack = resolvedUrl ? { ...track, resolvedUrl } : track;
        audioPlayer.play(preparedTrack);
      }
    } else {
      // Play next track
      await next();
    }
  });

  audioPlayer.on('error', (state) => {
    logger.error('AudioPlayer error', { track: state.currentTrack });
    set({ isPlaying: false });
  });

  // Start a timer to update current time and sync isPlaying state
  // Note: This interval is intentionally never cleaned up because:
  // 1. playerStore is a singleton that lives for the entire app lifetime
  // 2. The AudioPlayer instance is preserved across HMR via window global
  // 3. Zustand stores are not recreated during HMR
  setInterval(() => {
    const audioState = audioPlayer.getState();
    const storeState = get();
    
    // Sync isPlaying state if out of sync (e.g., after HMR)
    if (audioState.isPlaying !== storeState.isPlaying) {
      set({ isPlaying: audioState.isPlaying });
    }
    
    // Update time/duration when playing
    if (audioState.isPlaying) {
      set({ currentTime: audioState.currentTime, duration: audioState.duration });
      
      // Update Media Session position state for lock screen seek bar
      updateMediaSessionPositionState(
        audioState.currentTime,
        audioState.duration
      );
    }
  }, 500); // Update every 500ms

  const backupState = getBackupState();
  const audioState = audioPlayer.getState();

  return {
  // Initial state (restore from backup if HMR, otherwise start fresh)
  currentSong: backupState?.currentSong ?? null,
  queue: backupState?.queue ?? [],
  currentIndex: backupState?.currentIndex ?? -1,
  queueSource: backupState?.queueSource ?? null,
  queueSourceId: backupState?.queueSourceId ?? null,
  queueSourceName: backupState?.queueSourceName ?? null,
  isPlaying: audioState.isPlaying, // Always use AudioPlayer's actual state
  volume: backupState?.volume ?? 0.8,
  isMuted: backupState?.isMuted ?? false,
  repeatMode: backupState?.repeatMode ?? 'off',
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
      set({ currentSong: song, isPlaying: true });
      // Update Media Session metadata for lock screen display
      updateMediaSessionForSong(song);
      logger.info('Playing song', { songId: song.id, title: song.title });
    } else {
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
    set({
      queue: songs,
      currentIndex: startIndex,
      currentSong: songs[startIndex] || null,
    }),

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
      logger.warn('No song at start index', { startIndex, songCount: songs.length });
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
        logger.info('Updated library playlist', { playlistId, songCount: songIds.length });
      } else {
        // Create new playlist linked to library
        const newPlaylist = await api.main.playlists.createForLibrary({
          name: playlistName,
          linkedLibraryId: libraryId,
          songIds,
        });
        playlistId = newPlaylist.id;
        logger.info('Created library playlist', { playlistId, libraryId });
      }
      
      // Now play from this playlist
      get().playFromPlaylist(playlistId, playlistName, songs, startIndex);
      
    } catch (error) {
      logger.error('Failed to create/update library playlist', { error, libraryId });
      
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
        queueSource: 'library',
        queueSourceId: libraryId,
        queueSourceName: libraryName,
        isPlaying: true,
      });
    }
  },

  playFromPlaylist: async (playlistId, playlistName, songs, startIndex = 0) => {
    const currentRepeatMode = get().repeatMode;
    
    logger.info('playFromPlaylist called', { 
      playlistId, 
      playlistName, 
      songCount: songs.length, 
      startIndex,
      currentRepeatMode 
    });
    
    const currentSong = songs[startIndex];
    if (!currentSong) {
      logger.warn('No song at start index', { startIndex, songCount: songs.length });
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
      queueSource: 'playlist',
      queueSourceId: playlistId,
      queueSourceName: playlistName,
      isPlaying: true,
      // Preserve repeatMode and isShuffled
      repeatMode: currentRepeatMode,
    });
    
    logger.info('Playing from playlist', { 
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
      logger.warn('Cannot save empty queue as playlist');
      return false;
    }

    try {
      const songIds = queue.map((song) => song.id);
      const newPlaylist = await api.main.playlists.create({ name });
      
      // Add songs in order
      for (const songId of songIds) {
        await api.main.playlists.addSong(newPlaylist.id, { songId });
      }
      
      logger.info('Saved queue as playlist', { playlistName: name, songCount: songIds.length });
      return true;
    } catch (error) {
      logger.error('Failed to save queue as playlist', { error, name });
      return false;
    }
  },

  // Navigation
  next: async () => {
    const state = get();
    const { queue, currentIndex, repeatMode } = state;

    logger.info('Next button clicked - full state', { 
      queueLength: queue.length, 
      currentIndex, 
      repeatMode,
      isShuffled: state.isShuffled,
      isLastSong: currentIndex === queue.length - 1,
      fullState: {
        repeatMode: state.repeatMode,
        isPlaying: state.isPlaying,
        queueSource: state.queueSource,
      }
    });

    if (queue.length === 0) {
      logger.warn('Queue is empty, cannot play next');
      return;
    }

    let nextIndex: number;

    // Manual "next" button always loops (ignore repeat mode)
    // Repeat mode only affects automatic playback on track end
    if (currentIndex < queue.length - 1) {
      // Play next song in queue
      nextIndex = currentIndex + 1;
      logger.info('Playing next song in queue', { nextIndex });
    } else {
      // Loop back to first song (manual next always loops)
      nextIndex = 0;
      logger.info('Manual next: looping back to first song');
    }

    const nextSong = queue[nextIndex];
    if (nextSong) {
      const track = songToTrack(nextSong);
      const resolvedUrl = await prefetchAudioBlob(track.audioUrl);
      const preparedTrack = resolvedUrl ? { ...track, resolvedUrl } : track;
      
      audioPlayer.play(preparedTrack);
      set({
        currentIndex: nextIndex,
        currentSong: nextSong,
        currentTime: 0,
        isPlaying: true,
      });
      // Update Media Session metadata for the new song
      updateMediaSessionForSong(nextSong);
      logger.info('Playing next song', { 
        index: nextIndex, 
        title: nextSong.title,
        repeatMode,
        isLoopBack: nextIndex === 0 && currentIndex === queue.length - 1 
      });
    }
  },

  previous: async () => {
    const { queue, currentIndex, currentTime } = get();

    if (queue.length === 0) return;

    // If more than 3 seconds played, restart current song
    if (currentTime > 3) {
      audioPlayer.seek(0);
      set({ currentTime: 0 });
      logger.info('Restarting current song');
      return;
    }

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    const prevSong = queue[prevIndex];
    
    if (prevSong) {
      const track = songToTrack(prevSong);
      const resolvedUrl = await prefetchAudioBlob(track.audioUrl);
      const preparedTrack = resolvedUrl ? { ...track, resolvedUrl } : track;
      
      audioPlayer.play(preparedTrack);
      set({
        currentIndex: prevIndex,
        currentSong: prevSong,
        currentTime: 0,
        isPlaying: true,
      });
      // Update Media Session metadata for the new song
      updateMediaSessionForSong(prevSong);
      logger.info('Playing previous song', { index: prevIndex, title: prevSong.title });
    }
  },

  seekTo: async (index) => {
    const { queue } = get();

    if (index < 0 || index >= queue.length) return;

    const song = queue[index];
    if (song) {
      const track = songToTrack(song);
      const resolvedUrl = await prefetchAudioBlob(track.audioUrl);
      const preparedTrack = resolvedUrl ? { ...track, resolvedUrl } : track;
      
      audioPlayer.play(preparedTrack);
      set({
        currentIndex: index,
        currentSong: song,
        currentTime: 0,
        isPlaying: true,
      });
      // Update Media Session metadata for the new song
      updateMediaSessionForSong(song);
      logger.info('Seeking to song', { index, title: song.title });
    }
  },

  seek: (time) => {
    audioPlayer.seek(time);
    set({ currentTime: time });
    logger.info('Seeking to time', { time });
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
      logger.info('Saved repeat mode preference', { repeatMode: mode });
    } catch (error) {
      logger.error('Failed to save repeat mode preference', error);
    }
  },

  toggleRepeat: () => {
    const state = get();
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(state.repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    
    logger.info('Toggle repeat mode', { 
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
      logger.info('Saved shuffle preference', { shuffleEnabled: newShuffled });
    } catch (error) {
      logger.error('Failed to save shuffle preference', error);
    }
  },

  // Progress
  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  // Initialization & Persistence
  loadPlaybackProgress: async () => {
    try {
      logger.info('Loading playback progress...');
      
      // Load playback preferences (repeat mode and shuffle)
      // Skip if user has already modified preferences locally (prevent race condition)
      const { hasUserModifiedPreferences } = get();
      if (!hasUserModifiedPreferences) {
        try {
          const preferences = await api.main.player.getPreferences();
          if (preferences) {
            set({
              repeatMode: preferences.repeatMode,
              isShuffled: preferences.shuffleEnabled,
              hasLoadedPreferences: true,
            });
            logger.info('Loaded playback preferences', { 
              repeatMode: preferences.repeatMode, 
              shuffleEnabled: preferences.shuffleEnabled 
            });
          }
        } catch (prefError) {
          logger.warn('Failed to load playback preferences', prefError);
        }
      } else {
        logger.info('Skipped loading preferences - user has local changes');
      }
      
      const progress = await api.main.player.getProgress();
      
      if (!progress?.track) {
        logger.info('No playback progress found, trying seed...');
        // Try to load default seed as fallback
        try {
          const seed = await api.main.player.getSeed();
          if (seed?.track) {
            const song: Song = {
              id: seed.track.id,
              title: seed.track.title,
              artist: seed.track.artist ?? null,
              album: seed.track.album ?? null,
              albumArtist: null,
              genre: null,
              year: null,
              trackNumber: null,
              discNumber: null,
              composer: null,
              coverUrl: seed.track.coverUrl ?? null,
              libraryId: '', // Not available from seed
              libraryName: null, // Not available from seed
              fileId: '', // Not needed for playback
              duration: seed.track.duration ?? null,
              mimeType: seed.track.mimeType ?? null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            set({
              currentSong: song,
              queue: [song],
              currentIndex: 0,
              queueSource: seed.context.type as QueueSource,
              queueSourceId: seed.context.id,
              queueSourceName: seed.context.name,
              isPlaying: false, // Don't auto-play
            });
            
            // Prime AudioPlayer so it's ready to play
            const track = songToTrack(song);
            audioPlayer.prime(track);
            
            logger.info('Loaded default seed and primed player', { songId: song.id, title: song.title });
          }
        } catch (seedError) {
          logger.warn('Failed to load default seed', seedError);
        }
        return;
      }

      logger.info('Found playback progress', { 
        trackId: progress.track.id, 
        position: progress.position,
        context: progress.context 
      });

      // Convert API track to Song
      const song: Song = {
        id: progress.track.id,
        title: progress.track.title,
        artist: progress.track.artist ?? null,
        album: progress.track.album ?? null,
        albumArtist: null,
        genre: null,
        year: null,
        trackNumber: null,
        discNumber: null,
        composer: null,
        coverUrl: progress.track.coverUrl ?? null,
        libraryId: '', // Not available from progress
        libraryName: null, // Not available from progress
        fileId: '', // Not needed for playback
        duration: progress.track.duration ?? null,
        mimeType: progress.track.mimeType ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Load full queue based on context
      let fullQueue: Song[] = [song];
      let startIndex = 0;

      if (progress.context) {
        try {
          if (progress.context.type === 'playlist' && progress.context.id) {
            const songs = await api.main.playlists.getSongs(progress.context.id);
            if (songs && songs.length > 0) {
              fullQueue = songs; // Songs from API already match Song type
              startIndex = fullQueue.findIndex(s => s.id === song.id);
              if (startIndex === -1) startIndex = 0;
              logger.info('Loaded playlist queue', { 
                playlistId: progress.context.id, 
                songCount: fullQueue.length,
                startIndex 
              });
            }
          } else if (progress.context.type === 'library' && progress.context.id) {
            const songs = await api.main.libraries.getSongs(progress.context.id);
            if (songs && songs.length > 0) {
              fullQueue = songs; // Songs from API already match Song type
              startIndex = fullQueue.findIndex(s => s.id === song.id);
              if (startIndex === -1) startIndex = 0;
              logger.info('Loaded library queue', { 
                libraryId: progress.context.id, 
                songCount: fullQueue.length,
                startIndex 
              });
            }
          }
        } catch (queueError) {
          logger.warn('Failed to load full queue, using single track', queueError);
        }
      }

      // Update store state
      set({
        currentSong: song,
        queue: fullQueue,
        currentIndex: startIndex,
        queueSource: progress.context?.type as QueueSource ?? null,
        queueSourceId: progress.context?.id ?? null,
        queueSourceName: progress.context?.name ?? null,
        currentTime: progress.position,
        isPlaying: false, // Don't auto-play
      });

      // Preload audio and prime player
      const audioUrl = getStreamUrl(song.id);
      const objectUrl = await prefetchAudioBlob(audioUrl);
      
      const track = songToTrack(song);
      
      if (objectUrl) {
        // Auth mode: Use preloaded blob URL
        track.resolvedUrl = objectUrl;
        logger.info('Restored playback state with preloaded audio', { 
          songId: song.id, 
          position: progress.position,
          queueLength: fullQueue.length 
        });
      } else {
        // Guest mode: Service Worker handles streaming
        logger.info('Restored playback state (Guest mode - Service Worker streaming)', { 
          songId: song.id, 
          position: progress.position,
          queueLength: fullQueue.length 
        });
      }
      
      audioPlayer.prime(track);
      audioPlayer.seek(progress.position);
    } catch (error) {
      logger.error('Failed to load playback progress', error);
    }
  },

  savePlaybackProgress: () => {
    const { currentSong, currentTime, queueSource, queueSourceId, queueSourceName } = get();
    
    if (!currentSong) {
      return;
    }

    const contextType = (queueSource === 'library' || queueSource === 'playlist') 
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
        logger.info('Saved playback progress', { 
          songId: currentSong.id, 
          position: Math.round(currentTime) 
        });
      })
      .catch((error) => {
        logger.error('Failed to save playback progress', error);
      });
  },

  savePlaybackProgressSync: () => {
    const { currentSong, currentTime, queueSource, queueSourceId, queueSourceName } = get();
    
    if (!currentSong) {
      return;
    }

    const contextType = (queueSource === 'library' || queueSource === 'playlist') 
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
      logger.error('Failed to send playback progress with keepalive', err);
    });

    logger.info('Sent playback progress with keepalive', { 
      songId: currentSong.id, 
      position: Math.round(currentTime) 
    });
  },
  };
});

// Save state for HMR (development only)
if (import.meta.env.DEV) {
  usePlayerStore.subscribe((state) => {
    setBackupState({
      currentSong: state.currentSong,
      queue: state.queue,
      currentIndex: state.currentIndex,
      queueSource: state.queueSource,
      queueSourceId: state.queueSourceId,
      queueSourceName: state.queueSourceName,
      isPlaying: state.isPlaying, // Saved for completeness, but always overwritten during restore (read from AudioPlayer)
      volume: state.volume,
      isMuted: state.isMuted,
      repeatMode: state.repeatMode,
      isShuffled: state.isShuffled,
      currentTime: state.currentTime,
      duration: state.duration,
      hasLoadedPreferences: state.hasLoadedPreferences,
      hasUserModifiedPreferences: state.hasUserModifiedPreferences,
    });
  });
}
