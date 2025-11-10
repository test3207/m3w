import { create } from 'zustand';
import type { Song } from '@/types/models';

export type RepeatMode = 'off' | 'one' | 'all';

interface PlayerState {
  // Current playback
  currentSong: Song | null;
  queue: Song[];
  currentIndex: number;
  
  // Playback state
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  
  // Progress
  currentTime: number;
  duration: number;
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
  
  // Navigation
  next: () => void;
  previous: () => void;
  seekTo: (index: number) => void;
  
  // Audio settings
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  
  // Progress
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
}

type PlayerStore = PlayerState & PlayerActions;

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  // Initial state
  currentSong: null,
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  volume: 0.8,
  isMuted: false,
  repeatMode: 'off',
  isShuffled: false,
  currentTime: 0,
  duration: 0,

  // Playback control
  play: (song) => {
    if (song) {
      set({ currentSong: song, isPlaying: true });
    } else {
      set({ isPlaying: true });
    }
  },

  pause: () => set({ isPlaying: false }),

  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),

  stop: () =>
    set({
      isPlaying: false,
      currentTime: 0,
    }),

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

  clearQueue: () =>
    set({
      queue: [],
      currentIndex: -1,
      currentSong: null,
      isPlaying: false,
    }),

  // Navigation
  next: () => {
    const { queue, currentIndex, repeatMode } = get();

    if (queue.length === 0) return;

    let nextIndex: number;

    if (repeatMode === 'one') {
      nextIndex = currentIndex;
    } else if (currentIndex < queue.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (repeatMode === 'all') {
      nextIndex = 0;
    } else {
      // End of queue
      set({ isPlaying: false });
      return;
    }

    set({
      currentIndex: nextIndex,
      currentSong: queue[nextIndex],
      currentTime: 0,
    });
  },

  previous: () => {
    const { queue, currentIndex, currentTime } = get();

    if (queue.length === 0) return;

    // If more than 3 seconds played, restart current song
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;

    set({
      currentIndex: prevIndex,
      currentSong: queue[prevIndex],
      currentTime: 0,
    });
  },

  seekTo: (index) => {
    const { queue } = get();

    if (index >= 0 && index < queue.length) {
      set({
        currentIndex: index,
        currentSong: queue[index],
        currentTime: 0,
      });
    }
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

  setRepeatMode: (mode) => set({ repeatMode: mode }),

  toggleShuffle: () =>
    set((state) => {
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

        return { isShuffled: newShuffled, queue: shuffled };
      }

      return { isShuffled: newShuffled };
    }),

  // Progress
  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),
}));
