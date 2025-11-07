/**
 * Audio Player
 * 
 * Core audio playback functionality using Howler.js
 * Supports: play, pause, seek, volume control, queue management
 */

import { Howl, Howler } from 'howler';

export interface Track {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  audioUrl: string;
  duration?: number;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
}

export type PlayerEventType =
  | 'play'
  | 'pause'
  | 'end'
  | 'load'
  | 'seek'
  | 'volume'
  | 'error';

export type PlayerEventListener = (state: PlayerState) => void;

class AudioPlayer {
  private howl: Howl | null = null;
  private currentTrack: Track | null = null;
  private listeners: Map<PlayerEventType, Set<PlayerEventListener>> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Initialize event listener sets
    const events: PlayerEventType[] = ['play', 'pause', 'end', 'load', 'seek', 'volume', 'error'];
    events.forEach(event => this.listeners.set(event, new Set()));
  }

  /**
   * Load and play a track
   */
  async play(track: Track): Promise<void> {
    // If same track, just resume
    if (this.currentTrack?.id === track.id && this.howl) {
      this.howl.play();
      this.startProgressUpdate();
      this.emit('play');
      return;
    }

    // Stop current track
    this.stop();

    // Create new Howl instance
    this.currentTrack = track;
    this.howl = new Howl({
      src: [track.audioUrl],
      html5: true, // Use HTML5 Audio for streaming
      preload: true,
      onload: () => {
        this.emit('load');
      },
      onplay: () => {
        this.startProgressUpdate();
        this.emit('play');
      },
      onpause: () => {
        this.stopProgressUpdate();
        this.emit('pause');
      },
      onend: () => {
        this.stopProgressUpdate();
        this.emit('end');
      },
      onseek: () => {
        this.emit('seek');
      },
      onloaderror: (_id, error) => {
        console.error('Audio load error:', error);
        this.emit('error');
      },
      onplayerror: (_id, error) => {
        console.error('Audio play error:', error);
        this.emit('error');
      },
    });

    this.howl.play();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.howl && this.howl.playing()) {
      this.howl.pause();
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.howl && !this.howl.playing()) {
      this.howl.play();
    }
  }

  /**
   * Stop playback and unload
   */
  stop(): void {
    if (this.howl) {
      this.howl.stop();
      this.howl.unload();
      this.howl = null;
    }
    this.stopProgressUpdate();
    this.currentTrack = null;
  }

  /**
   * Seek to position (in seconds)
   */
  seek(position: number): void {
    if (this.howl) {
      this.howl.seek(position);
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(clampedVolume);
    this.emit('volume');
  }

  /**
   * Mute/unmute
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    Howler.mute(muted);
    this.emit('volume');
  }

  /**
   * Get current player state
   */
  getState(): PlayerState {
    return {
      currentTrack: this.currentTrack,
      isPlaying: this.howl?.playing() ?? false,
      currentTime: this.howl?.seek() as number ?? 0,
      duration: this.howl?.duration() ?? this.currentTrack?.duration ?? 0,
      volume: Howler.volume(),
      isMuted: this.isMuted,
      isLoading: this.howl?.state() === 'loading',
    };
  }

  /**
   * Subscribe to player events
   */
  on(event: PlayerEventType, callback: PlayerEventListener): () => void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.add(callback);
    }

    // Return unsubscribe function
    return () => {
      listeners?.delete(callback);
    };
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: PlayerEventType): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const state = this.getState();
      listeners.forEach(callback => callback(state));
    }
  }

  /**
   * Start progress update interval
   */
  private startProgressUpdate(): void {
    this.stopProgressUpdate();
    this.updateInterval = setInterval(() => {
      this.emit('seek');
    }, 100); // Update every 100ms
  }

  /**
   * Stop progress update interval
   */
  private stopProgressUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    this.stop();
    this.listeners.clear();
  }
}

// Singleton instance
let playerInstance: AudioPlayer | null = null;

export function getAudioPlayer(): AudioPlayer {
  if (!playerInstance) {
    playerInstance = new AudioPlayer();
  }
  return playerInstance;
}

export { AudioPlayer };
