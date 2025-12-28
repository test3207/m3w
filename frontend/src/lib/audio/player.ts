/**
 * Audio Player
 *
 * Core audio playback functionality using Howler.js
 * Supports: play, pause, seek, volume control, queue management
 */

import { Howl, Howler } from "howler";
import { logger } from "@/lib/logger-client";
import { resolveAudioFormat } from "./format-utils";

// String emitted by Howler when browser policies block autoplay without user gesture.
const HOWLER_AUTOPLAY_BLOCK_MESSAGE =
  "Playback was unable to start. This is most commonly an issue on mobile devices and Chrome where playback was not within a user interaction.";

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
  | "play"
  | "pause"
  | "end"
  | "load"
  | "seek"
  | "volume"
  | "error";

export type PlayerEventListener = (state: PlayerState) => void;

class AudioPlayer {
  private howl: Howl | null = null;
  private soundId: number | null = null; // Track the current sound instance
  private currentTrack: Track | null = null;
  private listeners: Map<PlayerEventType, Set<PlayerEventListener>> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isMuted: boolean = false;
  private isRecovering: boolean = false;
  private pendingSeek: number | null = null;

  constructor() {
    // Initialize event listener sets
    const events: PlayerEventType[] = ["play", "pause", "end", "load", "seek", "volume", "error"];
    events.forEach(event => this.listeners.set(event, new Set()));
  }

  /**
   * Load and play a track
   */
  async play(track: Track): Promise<void> {
    logger.info("[AudioPlayer][play]", "🎵 AudioPlayer.play() called", {
      raw: {
        trackId: track.id,
        title: track.title,
        audioUrl: track.audioUrl,
        duration: track.duration,
      }
    });

    // Always unload and create new Howl instance to ensure fresh event listeners
    this.unloadHowl();
    this.currentTrack = track;

    logger.info("[AudioPlayer][play]", "🎵 Creating Howl instance...");
    this.howl = this.createHowl(track);

    logger.info("[AudioPlayer][play]", "🎵 Calling howl.play()...", {
      raw: {
        howlState: this.howl.state(),
        howlPlaying: this.howl.playing(),
      }
    });
    // Store the sound ID returned by play() to reuse for pause/resume/seek
    this.soundId = this.howl.play();

    logger.info("[AudioPlayer][play]", "🎵 howl.play() called, waiting for onplay event", {
      raw: { soundId: this.soundId }
    });
  }

  /**
   * Prime player with a track without auto-playing
   */
  prime(track: Track): void {
    logger.info("[AudioPlayer][prime]", "Priming player", {
      raw: {
        trackId: track.id,
        audioUrl: track.audioUrl,
        hasExistingHowl: !!this.howl,
        isSameTrack: this.currentTrack?.id === track.id
      }
    });

    if (this.currentTrack?.id === track.id && this.howl) {
      this.emit("load");
      return;
    }

    if (!this.canInitializeAudio()) {
      logger.info("[AudioPlayer][prime]", "Cannot initialize audio yet, deferring");
      this.currentTrack = track;
      this.emit("load");
      return;
    }

    this.unloadHowl();
    this.currentTrack = track;
    logger.info("[AudioPlayer][prime]", "Creating Howl instance", { raw: { audioUrl: track.audioUrl } });
    this.howl = this.createHowl(track);
    this.howl.load();
    this.emit("load");
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.howl && this.howl.playing(this.soundId ?? undefined)) {
      this.howl.pause(this.soundId ?? undefined);
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.howl && this.soundId !== null) {
      if (!this.howl.playing(this.soundId)) {
        // Pass the existing sound ID to resume instead of creating new sound
        this.howl.play(this.soundId);
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
   * On mobile (especially Android lock screen), Howler's seek() can cause the audio
   * to get stuck in 'loading' state and never recover. We bypass Howler and directly
   * set the HTML5 Audio element's currentTime when in html5 mode.
   */
  seek(position: number): void {
    if (this.howl) {
      const state = this.howl.state();
      if (state === "loaded") {
        // Access the underlying HTML5 Audio element directly to avoid Howler's seek()
        // which can get stuck in 'loading' state on Android lock screen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const howlAny = this.howl as any;
        const sounds = howlAny._sounds;
        const sound = sounds?.find((s: { _id: number }) => s._id === this.soundId) || sounds?.[0];
        const audioNode = sound?._node as HTMLAudioElement | undefined;
        
        if (audioNode) {
          audioNode.currentTime = position;
        } else {
          // This fallback should rarely trigger in html5 mode.
          // On Android, this may cause audio to get stuck - log for debugging.
          logger.error("[AudioPlayer][seek]", "Native audio node not found, using Howler seek fallback");
          this.howl.seek(position, this.soundId ?? undefined);
        }
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
    this.emit("volume");
  }

  /**
   * Mute/unmute
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    Howler.mute(muted);
    this.emit("volume");
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
    const id = this.soundId ?? undefined;
    let currentTime = 0;
    let duration = 0;
    let isPlaying = false;
    let isLoading = false;

    if (howl) {
      try {
        // Wrap all Howler calls in try-catch to handle race conditions
        // where howl._sounds array may be empty during unload/switch
        const seekResult = howl.seek(id);
        currentTime = typeof seekResult === "number" && isFinite(seekResult) ? seekResult : 0;

        if (howl.state() !== "loaded" && this.pendingSeek !== null) {
          currentTime = this.pendingSeek;
        }

        // Get duration once and reuse to avoid race condition
        const howlDuration = howl.duration(id);
        duration = typeof howlDuration === "number" && isFinite(howlDuration) && howlDuration > 0
          ? howlDuration
          : (this.currentTrack?.duration ?? 0);

        isPlaying = howl.playing(id) ?? false;
        isLoading = howl.state() === "loading";
      } catch (error) {
        // Howler internal error (e.g., _sounds[id] undefined during race condition)
        // Fall back to safe defaults - log as warn so it shows in prod console
        const howlState = howl?.state();
        logger.warn("[AudioPlayer][getState]", "Howler internal error, using fallbacks", {
          raw: { 
            error: error instanceof Error ? error.message : String(error),
            soundId: id,
            howlState,
            trackId: this.currentTrack?.id
          }
        });
        duration = this.currentTrack?.duration ?? 0;
        // If we had a pending seek when the error occurred, use it as currentTime
        if (this.pendingSeek !== null) {
          currentTime = this.pendingSeek;
        }
        // Set loading state from howl if available
        isLoading = howlState === "loading";
        // Conservatively mark as not playing in error state
        isPlaying = false;
      }
    } else if (this.pendingSeek !== null) {
      currentTime = this.pendingSeek;
      duration = this.currentTrack?.duration ?? 0;
    }

    return {
      currentTrack: this.currentTrack,
      isPlaying,
      currentTime,
      duration,
      volume: Howler.volume(),
      isMuted: this.isMuted,
      isLoading,
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
      this.emit("seek");
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

    logger.info("[AudioPlayer][createHowl]", "🎵 Creating Howl with config", {
      raw: {
        sourceUrl,
        format,
        html5: true,
        preload: true,
      }
    });

    return new Howl({
      src: [sourceUrl],
      ...(format ? { format } : {}),
      html5: true,
      preload: true,
      onload: () => {
        logger.info("[AudioPlayer][onload]", "🎵 Howl onload fired");
        if (this.pendingSeek !== null && this.howl) {
          try {
            this.howl.seek(this.pendingSeek);
            this.pendingSeek = null;
          } catch (error) {
            logger.warn("[AudioPlayer][onload]", "Deferred seek during onload failed", { raw: { err: error } });
          }
        }
        this.emit("load");
      },
      onplay: () => {
        logger.info("[AudioPlayer][onplay]", "🎵 Howl onplay fired");
        this.isRecovering = false;
        if (this.pendingSeek !== null && this.howl) {
          const target = this.pendingSeek;
          this.pendingSeek = null;
          try {
            this.howl.seek(target);
          } catch (error) {
            logger.warn("[AudioPlayer][onplay]", "Deferred seek during onplay failed", { raw: { err: error } });
          }
        }
        this.startProgressUpdate();
        this.emit("play");
      },
      onpause: () => {
        logger.info("[AudioPlayer][onpause]", "🎵 Howl onpause fired");
        this.stopProgressUpdate();
        this.emit("pause");
      },
      onend: () => {
        logger.info("[AudioPlayer][onend]", "🎵 Howl onend fired");
        this.stopProgressUpdate();
        this.emit("end");
      },
      onseek: () => {
        logger.info("[AudioPlayer][onseek]", "🎵 Howl onseek fired");
        this.emit("seek");
      },
      onloaderror: (_id, error) => {
        logger.error("[AudioPlayer][onloaderror]", "🎵 Howl onloaderror fired", error);

        // In development, hot reload or initial page load can cause stale audio URLs
        // Suppress errors if we're in dev mode and the player hasn't been actively used
        const isDev = import.meta.env.DEV;
        const hasUserInteraction = this.howl?.playing() || false;

        if (isDev && !hasUserInteraction && !this.currentTrack) {
          logger.info("[AudioPlayer][onloaderror]", "Audio load error suppressed (likely dev environment or page load)", { raw: { err: error } });
          return;
        }

        // Only log errors for actual playback attempts
        if (hasUserInteraction || !isDev) {
          logger.error("[AudioPlayer][onloaderror]", "Audio load error", error);
          this.emit("error");
        }
      },
      onplayerror: (_id, error) => {
        logger.error("[AudioPlayer][onplayerror]", "🎵 Howl onplayerror fired", error);

        const trackContext = this.currentTrack ? { trackId: this.currentTrack.id } : {};
        const logPayload = {
          ...(error ? { err: error } : {}),
          ...trackContext,
        };

        const autoplayBlocked =
          typeof error === "string" && error.includes(HOWLER_AUTOPLAY_BLOCK_MESSAGE);

        if (this.isRecovering) {
          logger.error("[AudioPlayer][onplayerror]", "Audio play retry failed", logPayload.err ? new Error(String(logPayload.err)) : new Error("Unknown error"), { raw: { ...trackContext } });
        } else if (autoplayBlocked) {
          // Browsers reject autoplay without user interaction; downgrade noise to info level.
          logger.info("[AudioPlayer][onplayerror]", "Audio play blocked by autoplay policy", { raw: { ...trackContext } });
        } else {
          logger.warn("[AudioPlayer][onplayerror]", "Audio play failed, attempting recovery", { raw: { ...trackContext } });
        }

        const audioCtx = Howler.ctx;
        if (audioCtx?.state === "suspended") {
          void audioCtx.resume().catch((resumeError: unknown) => {
            logger.error("[AudioPlayer][onplayerror]", "Audio context resume failed", resumeError, { raw: trackContext });
          });
        }

        const trackToRetry = this.currentTrack;
        this.unloadHowl();

        if (trackToRetry && !this.isRecovering) {
          this.isRecovering = true;
          void this.play(trackToRetry).catch((retryError: unknown) => {
            logger.error("[AudioPlayer][onplayerror]", "Audio auto-retry failed", retryError, { raw: trackContext });
            this.isRecovering = false;
          });
        } else {
          this.isRecovering = false;
        }

        this.emit("error");
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
    this.soundId = null; // Clear sound ID
    this.stopProgressUpdate();
    this.pendingSeek = null; // Clear pending seek to avoid state issues
  }

  private canInitializeAudio(): boolean {
    if (typeof window === "undefined") {
      return true;
    }

    const userActivation = navigator.userActivation;
    if (userActivation && !userActivation.hasBeenActive) {
      return false;
    }

    const audioCtx = Howler.ctx;
    if (audioCtx?.state !== "running") {
      return false;
    }

    return true;
  }
}

// Singleton instance - use window to survive HMR
declare global {
  interface Window {
    __AUDIO_PLAYER_INSTANCE__?: AudioPlayer;
  }
}

let playerInstance: AudioPlayer | null = window.__AUDIO_PLAYER_INSTANCE__ || null;

export function getAudioPlayer(): AudioPlayer {
  if (!playerInstance) {
    playerInstance = new AudioPlayer();
    window.__AUDIO_PLAYER_INSTANCE__ = playerInstance;
  }
  return playerInstance;
}

// Note: We intentionally do NOT unload on HMR to keep audio playing
// The playerInstance survives via window.__AUDIO_PLAYER_INSTANCE__

export { AudioPlayer };
