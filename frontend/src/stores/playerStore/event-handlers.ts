/**
 * PlayerStore event handlers setup
 * - Media Session handlers (lock screen controls)
 * - AudioPlayer event listeners
 * - Sync interval for state synchronization
 */

import { RepeatMode } from "@/lib/shared";
import { getAudioPlayer, type AudioPlayer } from "@/lib/audio/player";
import { prefetchAudioBlob } from "@/lib/audio/prefetch";
import {
  registerMediaSessionHandlers,
  updateMediaSessionPlaybackState,
  updateMediaSessionPositionState,
} from "@/lib/audio/media-session";
import { logger } from "@/lib/logger-client";
import type { PlayerStore } from "./types";
import { songToTrack, updateMediaSessionForSong } from "./helpers";
import { clearSyncInterval, setSyncIntervalId } from "./hmr-support";

type StoreGetter = () => PlayerStore;

/**
 * Setup Media Session handlers for lock screen controls
 * Uses getState() to access current state so handlers always reflect latest queue/position
 */
export function setupMediaSessionHandlers(
  audioPlayer: AudioPlayer,
  getState: StoreGetter,
  setState: (partial: Partial<PlayerStore>) => void
): void {
  registerMediaSessionHandlers({
    onPlay: () => {
      const { currentSong, duration, currentTime } = getState();
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
      void getState().previous();
    },
    onNextTrack: () => {
      void getState().next();
    },
    onSeekTo: (time: number) => {
      const { duration } = getState();
      // Validate inputs before seeking
      if (!isFinite(time) || !isFinite(duration) || duration <= 0) return;
      const clampedTime = Math.max(0, Math.min(time, duration));
      audioPlayer.seek(clampedTime);
      setState({ currentTime: clampedTime });
      updateMediaSessionPositionState(clampedTime, duration);
    },
    onSeekBackward: (offset: number) => {
      const { currentTime, duration } = getState();
      // Validate all inputs before seeking
      if (!isFinite(offset) || offset <= 0) return;
      if (!isFinite(currentTime) || !isFinite(duration) || duration <= 0) return;
      const newTime = Math.max(0, currentTime - offset);
      audioPlayer.seek(newTime);
      setState({ currentTime: newTime });
      updateMediaSessionPositionState(newTime, duration);
    },
    onSeekForward: (offset: number) => {
      const { currentTime, duration } = getState();
      // Validate all inputs before seeking
      if (!isFinite(offset) || offset <= 0) return;
      if (!isFinite(currentTime) || !isFinite(duration) || duration <= 0) return;
      const newTime = Math.min(duration, currentTime + offset);
      audioPlayer.seek(newTime);
      setState({ currentTime: newTime });
      updateMediaSessionPositionState(newTime, duration);
    },
  });
}

/**
 * Setup AudioPlayer event listeners for state synchronization
 */
export function setupAudioPlayerListeners(
  audioPlayer: AudioPlayer,
  getState: StoreGetter,
  setState: (partial: Partial<PlayerStore>) => void
): void {
  audioPlayer.on("play", (state) => {
    setState({ isPlaying: true, currentTime: state.currentTime, duration: state.duration });
    updateMediaSessionPlaybackState("playing");
    logger.info("[PlayerStore][onplay]", "AudioPlayer playing");
  });

  audioPlayer.on("pause", (state) => {
    setState({ isPlaying: false, currentTime: state.currentTime });
    updateMediaSessionPlaybackState("paused");
    // Update position state to ensure lock screen reflects current position
    updateMediaSessionPositionState(state.currentTime, state.duration);
    logger.info("[PlayerStore][onpause]", "AudioPlayer paused");
  });

  audioPlayer.on("end", async () => {
    const { next, repeatMode, currentSong } = getState();
    logger.info("[PlayerStore][onend]", `Track ended, repeatMode: ${repeatMode}`);

    if (repeatMode === RepeatMode.One) {
      // Replay current track
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

  audioPlayer.on("error", (state) => {
    logger.error("[PlayerStore][onerror]", "AudioPlayer error", undefined, { raw: { track: state.currentTrack } });
    setState({ isPlaying: false });
  });
}

/**
 * Setup sync interval for state synchronization with AudioPlayer
 * This ensures store state stays in sync with AudioPlayer's actual state
 */
export function setupSyncInterval(
  audioPlayer: AudioPlayer,
  getState: StoreGetter,
  setState: (partial: Partial<PlayerStore>) => void
): void {
  // Clear any existing interval (prevents accumulation during HMR)
  clearSyncInterval();

  const intervalId = setInterval(() => {
    const audioState = audioPlayer.getState();
    const storeState = getState();

    // Sync isPlaying state if out of sync (e.g., after HMR)
    if (audioState.isPlaying !== storeState.isPlaying) {
      setState({ isPlaying: audioState.isPlaying });
    }

    // Update time/duration when playing
    if (audioState.isPlaying) {
      setState({ currentTime: audioState.currentTime, duration: audioState.duration });

      // Update Media Session position state for lock screen seek bar
      updateMediaSessionPositionState(audioState.currentTime, audioState.duration);
    }
  }, 500);

  setSyncIntervalId(intervalId);
}

/**
 * Initialize all event handlers for the player store
 * Called once during store creation (with HMR guard)
 */
export function initializeEventHandlers(
  getState: StoreGetter,
  setState: (partial: Partial<PlayerStore>) => void
): void {
  const audioPlayer = getAudioPlayer();

  setupMediaSessionHandlers(audioPlayer, getState, setState);
  setupAudioPlayerListeners(audioPlayer, getState, setState);
  setupSyncInterval(audioPlayer, getState, setState);
}
