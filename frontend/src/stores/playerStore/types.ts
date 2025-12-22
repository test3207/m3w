/**
 * Player Store Types
 * 
 * Type definitions for the player Zustand store.
 */

import type { Song } from "@m3w/shared";
import { RepeatMode } from "@m3w/shared/types";

export type QueueSource = "library" | "playlist" | "all" | null;

export interface PlayerState {
  // Current playback
  currentSong: Song | null;
  lastPlayedSong: Song | null; // Keeps last valid song for UI display during exit animations
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

export interface PlayerActions {
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

export type PlayerStore = PlayerState & PlayerActions;

// Re-export RepeatMode for convenience
export { RepeatMode } from "@m3w/shared/types";
