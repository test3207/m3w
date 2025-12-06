/**
 * Media Session API Integration
 *
 * Provides lock screen and notification media controls on mobile devices.
 * Handles: play/pause, previous/next track buttons, seek bar, metadata display.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
 */

import { logger } from '@/lib/logger-client';

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
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
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
        { src: track.coverUrl, sizes: '96x96' },
        { src: track.coverUrl, sizes: '128x128' },
        { src: track.coverUrl, sizes: '192x192' },
        { src: track.coverUrl, sizes: '256x256' },
        { src: track.coverUrl, sizes: '384x384' },
        { src: track.coverUrl, sizes: '512x512' }
      );
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist ?? '',
      album: track.album ?? '',
      artwork,
    });

    logger.info('Media Session metadata updated', {
      title: track.title,
      artist: track.artist,
      hasArtwork: artwork.length > 0,
    });
  } catch (error) {
    logger.warn('Failed to update Media Session metadata', { error });
  }
}

/**
 * Update Media Session playback state
 */
export function updateMediaSessionPlaybackState(
  state: 'playing' | 'paused' | 'none'
): void {
  if (!isMediaSessionSupported()) {
    return;
  }

  try {
    navigator.mediaSession.playbackState = state;
  } catch (error) {
    logger.warn('Failed to update Media Session playback state', { error });
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
    logger.debug('Failed to update Media Session position state', { error });
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
    logger.info('Media Session API not supported');
    return;
  }

  try {
    // Play/Pause controls
    if (callbacks.onPlay) {
      navigator.mediaSession.setActionHandler('play', () => {
        logger.info('Media Session: play action triggered');
        callbacks.onPlay?.();
      });
    }

    if (callbacks.onPause) {
      navigator.mediaSession.setActionHandler('pause', () => {
        logger.info('Media Session: pause action triggered');
        callbacks.onPause?.();
      });
    }

    // Previous/Next track controls (the main fix for Issue #110)
    if (callbacks.onPreviousTrack) {
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        logger.info('Media Session: previoustrack action triggered');
        callbacks.onPreviousTrack?.();
      });
    }

    if (callbacks.onNextTrack) {
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        logger.info('Media Session: nexttrack action triggered');
        callbacks.onNextTrack?.();
      });
    }

    // Seek controls (optional but nice to have)
    if (callbacks.onSeekTo) {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && isFinite(details.seekTime) && details.seekTime >= 0) {
          logger.info('Media Session: seekto action triggered', {
            seekTime: details.seekTime,
          });
          callbacks.onSeekTo?.(details.seekTime);
        }
      });
    }

    if (callbacks.onSeekBackward) {
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset ?? DEFAULT_SEEK_OFFSET;
        // Validate offset is a positive finite number
        if (!isFinite(offset) || offset <= 0) return;
        logger.info('Media Session: seekbackward action triggered', { offset });
        callbacks.onSeekBackward?.(offset);
      });
    }

    if (callbacks.onSeekForward) {
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset ?? DEFAULT_SEEK_OFFSET;
        // Validate offset is a positive finite number
        if (!isFinite(offset) || offset <= 0) return;
        logger.info('Media Session: seekforward action triggered', { offset });
        callbacks.onSeekForward?.(offset);
      });
    }

    logger.info('Media Session handlers registered', {
      handlers: Object.keys(callbacks).filter(
        (k) => callbacks[k as keyof MediaSessionCallbacks]
      ),
    });
  } catch (error) {
    logger.warn('Failed to register Media Session handlers', { error });
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
    navigator.mediaSession.playbackState = 'none';
    // Also clear position state to prevent stale seek bar
    try {
      navigator.mediaSession.setPositionState();
    } catch {
      // setPositionState without args may not be supported in all browsers
    }
  } catch (error) {
    logger.warn('Failed to clear Media Session metadata', { error });
  }
}
