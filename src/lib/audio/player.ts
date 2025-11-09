/**
 * Audio Player
 * 
 * Core audio playback functionality using Howler.js
 * Supports: play, pause, seek, volume control, queue management
 */

import { Howl, Howler } from 'howler';
import { logger } from '@/lib/logger';

// String emitted by Howler when browser policies block autoplay without user gesture.
const HOWLER_AUTOPLAY_BLOCK_MESSAGE =
  'Playback was unable to start. This is most commonly an issue on mobile devices and Chrome where playback was not within a user interaction.';

const MIME_TYPE_TO_FORMAT: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mpeg3': 'mp3',
  'audio/x-mp3': 'mp3',
  'audio/aac': 'aac',
  'audio/aacp': 'aac',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/webm': 'webm',
  'audio/3gpp': '3gp',
  'audio/3gpp2': '3g2',
};

function extractExtensionFromUrl(url: string): string | null {
  const sanitized = url.split('?')[0];
  const lastSegment = sanitized.split('/').pop();
  if (!lastSegment) {
    return null;
  }

  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === lastSegment.length - 1) {
    return null;
  }

  return lastSegment.slice(dotIndex + 1).toLowerCase();
}

function resolveAudioFormat(track: Track): string[] | undefined {
  const mimeType = track.mimeType?.toLowerCase();
  if (mimeType) {
    const mapped = MIME_TYPE_TO_FORMAT[mimeType];
    if (mapped) {
      return [mapped];
    }

    if (mimeType.startsWith('audio/')) {
      const subtype = mimeType.split('/')[1]?.split(';')[0]?.split('+')[0];
      if (subtype) {
        return [subtype];
      }
    }
  }

  const extension = extractExtensionFromUrl(track.audioUrl);
  if (extension) {
    return [extension];
  }

  return undefined;
}

export interface Track {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  audioUrl: string;
  duration?: number;
  mimeType?: string;
  resolvedUrl?: string;
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
  private isRecovering: boolean = false;
  private pendingSeek: number | null = null;

  constructor() {
    // Initialize event listener sets
    const events: PlayerEventType[] = ['play', 'pause', 'end', 'load', 'seek', 'volume', 'error'];
    events.forEach(event => this.listeners.set(event, new Set()));
  }

  /**
   * Load and play a track
   */
  async play(track: Track): Promise<void> {
    if (this.currentTrack?.id === track.id && this.howl) {
      this.howl.stop();
      this.howl.seek(0);
      this.howl.play();
      this.startProgressUpdate();
      this.emit('play');
      return;
    }

    this.unloadHowl();
    this.currentTrack = track;
    this.howl = this.createHowl(track);
    this.howl.play();
  }

  /**
   * Prime player with a track without auto-playing
   */
  prime(track: Track): void {
    if (this.currentTrack?.id === track.id && this.howl) {
      this.emit('load');
      return;
    }

    if (!this.canInitializeAudio()) {
      this.currentTrack = track;
      this.emit('load');
      return;
    }

    this.unloadHowl();
    this.currentTrack = track;
    this.howl = this.createHowl(track);
    this.howl.load();
    this.emit('load');
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
    if (this.howl) {
      if (!this.howl.playing()) {
        this.howl.play();
      }
      return;
    }

    if (this.currentTrack) {
      void this.play(this.currentTrack);
    }
  }

  /**
   * Stop playback and unload
   */
  stop(): void {
    this.unloadHowl();
    this.currentTrack = null;
  }

  /**
   * Seek to position (in seconds)
   */
  seek(position: number): void {
    if (this.howl) {
      const state = this.howl.state();
      if (state === 'loaded') {
        this.howl.seek(position);
        this.pendingSeek = null;
      } else {
        this.pendingSeek = position;
      }
    } else {
      this.pendingSeek = position;
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
   * Set a pending seek position to apply once audio is ready
   */
  setPendingSeek(position: number | null): void {
    this.pendingSeek = position;
  }

  /**
   * Get current player state
   */
  getState(): PlayerState {
    const howl = this.howl;
    let currentTime = 0;

    if (howl) {
      currentTime = howl.seek() ?? 0;

      if (howl.state() !== 'loaded' && this.pendingSeek !== null) {
        currentTime = this.pendingSeek;
      }
    } else if (this.pendingSeek !== null) {
      currentTime = this.pendingSeek;
    }

    return {
      currentTrack: this.currentTrack,
      isPlaying: howl?.playing() ?? false,
      currentTime,
      duration: howl?.duration() ?? this.currentTrack?.duration ?? 0,
      volume: Howler.volume(),
      isMuted: this.isMuted,
      isLoading: howl?.state() === 'loading',
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

  /**
   * Create configured Howl instance for track
   */
  private createHowl(track: Track): Howl {
    const sourceUrl = track.resolvedUrl ?? track.audioUrl;
    const format = resolveAudioFormat(track);

    return new Howl({
      src: [sourceUrl],
      ...(format ? { format } : {}),
      html5: true,
      preload: true,
      onload: () => {
        if (this.pendingSeek !== null && this.howl) {
          try {
            this.howl.seek(this.pendingSeek);
            this.pendingSeek = null;
          } catch (error) {
            logger.warn({ err: error }, 'Deferred seek during onload failed');
          }
        }
        this.emit('load');
      },
      onplay: () => {
        this.isRecovering = false;
        if (this.pendingSeek !== null && this.howl) {
          const target = this.pendingSeek;
          this.pendingSeek = null;
          try {
            this.howl.seek(target);
          } catch (error) {
            logger.warn({ err: error }, 'Deferred seek during onplay failed');
          }
        }
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
        logger.error({ err: error }, 'Audio load error');
        this.emit('error');
      },
      onplayerror: (_id, error) => {
        const trackContext = this.currentTrack ? { trackId: this.currentTrack.id } : {};
        const logPayload = {
          ...(error ? { err: error } : {}),
          ...trackContext,
        };

        const autoplayBlocked =
          typeof error === 'string' && error.includes(HOWLER_AUTOPLAY_BLOCK_MESSAGE);

        if (this.isRecovering) {
          logger.error(logPayload, 'Audio play retry failed');
        } else if (autoplayBlocked) {
          // Browsers reject autoplay without user interaction; downgrade noise to debug level.
          logger.debug(logPayload, 'Audio play blocked by autoplay policy');
        } else {
          logger.warn(logPayload, 'Audio play failed, attempting recovery');
        }

        const audioCtx = Howler.ctx;
        if (audioCtx?.state === 'suspended') {
          void audioCtx.resume().catch((resumeError: unknown) => {
            logger.error({ err: resumeError, ...trackContext }, 'Audio context resume failed');
          });
        }

        const trackToRetry = this.currentTrack;
        this.unloadHowl();

        if (trackToRetry && !this.isRecovering) {
          this.isRecovering = true;
          void this.play(trackToRetry).catch((retryError: unknown) => {
            logger.error({ err: retryError, ...trackContext }, 'Audio auto-retry failed');
            this.isRecovering = false;
          });
        } else {
          this.isRecovering = false;
        }

        this.emit('error');
      },
    });
  }

  /**
   * Tear down existing Howl instance and progress updates
   */
  private unloadHowl(): void {
    if (this.howl) {
      this.howl.stop();
      this.howl.unload();
      this.howl = null;
    }
    this.stopProgressUpdate();
  }

  private canInitializeAudio(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }

    const userActivation = navigator.userActivation;
    if (userActivation && !userActivation.hasBeenActive) {
      return false;
    }

    const audioCtx = Howler.ctx;
    if (audioCtx?.state !== 'running') {
      return false;
    }

    return true;
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
