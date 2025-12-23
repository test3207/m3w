/**
 * Media Session API Integration
 *
 * Provides lock screen and notification media controls on mobile devices.
 * Handles: play/pause, previous/next track buttons, seek bar, metadata display.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
 */

import { logger } from "@/lib/logger-client";

export interface MediaSessionTrack {
  title: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  duration?: number;
}

export interface MediaSessionCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  onSeekTo?: (time: number) => void;
  onSeekBackward?: (offset: number) => void;
  onSeekForward?: (offset: number) => void;
}

// Default seek offset in seconds
const DEFAULT_SEEK_OFFSET = 10;

/**
 * Check if Media Session API is supported
 */
export function isMediaSessionSupported(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

/**
 * Update Media Session metadata (song info displayed on lock screen)
 */
export function updateMediaSessionMetadata(track: MediaSessionTrack): void {
  if (!isMediaSessionSupported()) {
    return;
  }

  try {
    const artwork: MediaImage[] = [];
    if (track.coverUrl) {
      // Provide multiple sizes for different contexts
      // Omit 'type' to let the browser infer from response headers (covers can be JPEG, PNG, WebP, etc.)
      artwork.push(
        { src: track.coverUrl, sizes: "96x96" },
        { src: track.coverUrl, sizes: "128x128" },
        { src: track.coverUrl, sizes: "192x192" },
        { src: track.coverUrl, sizes: "256x256" },
        { src: track.coverUrl, sizes: "384x384" },
        { src: track.coverUrl, sizes: "512x512" }
      );
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist ?? "",
      album: track.album ?? "",
      artwork,
    });

    logger.info("[MediaSession][updateMediaSessionMetadata]", "Media Session metadata updated", {
      raw: {
        title: track.title,
        artist: track.artist,
        hasArtwork: artwork.length > 0,
      }
    });
  } catch (error) {
    logger.warn("[MediaSession][updateMediaSessionMetadata]", "Failed to update Media Session metadata", { raw: { error } });
  }
}

/**
 * Update Media Session playback state
 */
export function updateMediaSessionPlaybackState(
  state: "playing" | "paused" | "none"
): void {
  if (!isMediaSessionSupported()) {
    return;
  }

  try {
    navigator.mediaSession.playbackState = state;
  } catch (error) {
    logger.warn("[MediaSession][updateMediaSessionPlaybackState]", "Failed to update Media Session playback state", { raw: { error } });
  }
}

/**
 * Update Media Session position state (for seek bar on lock screen)
 */
export function updateMediaSessionPositionState(
  position: number,
  duration: number,
  playbackRate: number = 1
): void {
  if (!isMediaSessionSupported()) {
    return;
  }

  // Validate inputs to prevent errors (NaN, Infinity, negative values)
  if (duration <= 0 || !isFinite(duration) || !isFinite(position)) {
    return;
  }

  const clampedPosition = Math.max(0, Math.min(position, duration));

  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate,
      position: clampedPosition,
    });
  } catch (error) {
    // Some browsers don't support setPositionState
    logger.debug("[MediaSession][updateMediaSessionPositionState]", "Failed to update Media Session position state", { raw: { error } });
  }
}

/**
 * Register Media Session action handlers
 * Call this once during app initialization
 */
export function registerMediaSessionHandlers(
  callbacks: MediaSessionCallbacks
): void {
  if (!isMediaSessionSupported()) {
    logger.info("[MediaSession][registerMediaSessionHandlers]", "Media Session API not supported");
    return;
  }

  try {
    // Play/Pause controls
    if (callbacks.onPlay) {
      navigator.mediaSession.setActionHandler("play", () => {
        try {
          logger.info("[MediaSession][play]", "Media Session: play action triggered");
          callbacks.onPlay?.();
        } catch (error) {
          logger.warn("[MediaSession][play]", "Media Session: play callback error", { raw: { error } });
        }
      });
    }

    if (callbacks.onPause) {
      navigator.mediaSession.setActionHandler("pause", () => {
        try {
          logger.info("[MediaSession][pause]", "Media Session: pause action triggered");
          callbacks.onPause?.();
        } catch (error) {
          logger.warn("[MediaSession][pause]", "Media Session: pause callback error", { raw: { error } });
        }
      });
    }

    // Previous/Next track controls (the main fix for Issue #110)
    if (callbacks.onPreviousTrack) {
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        try {
          logger.info("[MediaSession][previoustrack]", "Media Session: previoustrack action triggered");
          callbacks.onPreviousTrack?.();
        } catch (error) {
          logger.warn("[MediaSession][previoustrack]", "Media Session: previoustrack callback error", { raw: { error } });
        }
      });
    }

    if (callbacks.onNextTrack) {
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        try {
          logger.info("[MediaSession][nexttrack]", "Media Session: nexttrack action triggered");
          callbacks.onNextTrack?.();
        } catch (error) {
          logger.warn("[MediaSession][nexttrack]", "Media Session: nexttrack callback error", { raw: { error } });
        }
      });
    }

    // Seek controls (optional but nice to have)
    if (callbacks.onSeekTo) {
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        try {
          if (details.seekTime !== undefined && isFinite(details.seekTime) && details.seekTime >= 0) {
            logger.info("[MediaSession][seekto]", "Media Session: seekto action triggered", {
              raw: { seekTime: details.seekTime }
            });
            callbacks.onSeekTo?.(details.seekTime);
          }
        } catch (error) {
          logger.warn("[MediaSession][seekto]", "Media Session: seekto callback error", { raw: { error } });
        }
      });
    }

    if (callbacks.onSeekBackward) {
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        try {
          const offset = details.seekOffset ?? DEFAULT_SEEK_OFFSET;
          // Validate offset is a positive finite number
          if (!isFinite(offset) || offset <= 0) return;
          logger.info("[MediaSession][seekbackward]", "Media Session: seekbackward action triggered", { raw: { offset } });
          callbacks.onSeekBackward?.(offset);
        } catch (error) {
          logger.warn("[MediaSession][seekbackward]", "Media Session: seekbackward callback error", { raw: { error } });
        }
      });
    }

    if (callbacks.onSeekForward) {
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        try {
          const offset = details.seekOffset ?? DEFAULT_SEEK_OFFSET;
          // Validate offset is a positive finite number
          if (!isFinite(offset) || offset <= 0) return;
          logger.info("[MediaSession][seekforward]", "Media Session: seekforward action triggered", { raw: { offset } });
          callbacks.onSeekForward?.(offset);
        } catch (error) {
          logger.warn("[MediaSession][seekforward]", "Media Session: seekforward callback error", { raw: { error } });
        }
      });
    }

    logger.info("[MediaSession][registerMediaSessionHandlers]", "Media Session handlers registered", {
      raw: {
        handlers: Object.keys(callbacks).filter(
          (k) => callbacks[k as keyof MediaSessionCallbacks]
        ),
      }
    });
  } catch (error) {
    logger.warn("[MediaSession][registerMediaSessionHandlers]", "Failed to register Media Session handlers", { raw: { error } });
  }
}

/**
 * Clear Media Session metadata
 */
export function clearMediaSessionMetadata(): void {
  if (!isMediaSessionSupported()) {
    return;
  }

  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
    // Also clear position state to prevent stale seek bar
    try {
      navigator.mediaSession.setPositionState();
    } catch {
      // setPositionState without args may not be supported in all browsers
    }
  } catch (error) {
    logger.warn("[MediaSession][clearMediaSessionMetadata]", "Failed to clear Media Session metadata", { raw: { error } });
  }
}
