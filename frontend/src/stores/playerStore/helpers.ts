/**
 * Player Store Helpers
 * 
 * Utility functions for the player store, including offline playback support,
 * track conversion, and Media Session integration.
 */

import { type Song } from "@m3w/shared";
import { type Track } from "@/lib/audio/player";
import {
  updateMediaSessionMetadata,
  updateMediaSessionPositionState,
  clearMediaSessionMetadata,
} from "@/lib/audio/media-session";
import { prefetchAudioBlob } from "@/lib/audio/prefetch";
import { getStreamUrl } from "@/services/api/main/endpoints";
import { isSongCached } from "@/lib/storage/audio-cache";
import { buildCoverUrl } from "@/lib/utils/url";
import type { PlayerState } from "./types";

/**
 * Find next playable song index when offline.
 * Returns { nextIndex, skippedCount } or null if no playable song found.
 */
export async function findNextPlayableSong(
  queue: Song[],
  startIndex: number,
  isOfflineAuth: boolean
): Promise<{ nextIndex: number; skippedCount: number } | null> {
  if (!isOfflineAuth) {
    // Online or Guest: all songs playable
    return { nextIndex: startIndex, skippedCount: 0 };
  }

  let skippedCount = 0;
  let checkedCount = 0;
  let index = startIndex;

  // Search through the entire queue (max queue.length checks)
  while (checkedCount < queue.length) {
    const song = queue[index];
    if (song && await isSongCached(song.id)) {
      return { nextIndex: index, skippedCount };
    }
    
    // Song not cached, skip it
    skippedCount++;
    index = (index + 1) % queue.length; // Wrap around
    checkedCount++;
  }

  // No cached songs found in entire queue
  return null;
}

/**
 * Find previous playable song index when offline (searches backwards).
 * Returns { prevIndex, skippedCount } or null if no playable song found.
 */
export async function findPreviousPlayableSong(
  queue: Song[],
  startIndex: number,
  isOfflineAuth: boolean
): Promise<{ prevIndex: number; skippedCount: number } | null> {
  if (!isOfflineAuth) {
    // Online or Guest: all songs playable
    return { prevIndex: startIndex, skippedCount: 0 };
  }

  let skippedCount = 0;
  let checkedCount = 0;
  let index = startIndex;

  // Search through the entire queue backwards (max queue.length checks)
  while (checkedCount < queue.length) {
    const song = queue[index];
    if (song && await isSongCached(song.id)) {
      return { prevIndex: index, skippedCount };
    }
    
    // Song not cached, skip it
    skippedCount++;
    index = index > 0 ? index - 1 : queue.length - 1; // Wrap around backwards
    checkedCount++;
  }

  // No cached songs found in entire queue
  return null;
}

/**
 * Convert a Song to a Track for the AudioPlayer.
 */
export function songToTrack(song: Song): Track {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist || undefined,
    album: song.album || undefined,
    coverUrl: buildCoverUrl(song.id) ?? undefined,
    duration: song.duration || undefined,
    mimeType: song.mimeType || undefined,
    audioUrl: getStreamUrl(song.id),
  };
}

/**
 * Update Media Session with current song info.
 */
export function updateMediaSessionForSong(song: Song | null): void {
  if (!song) {
    clearMediaSessionMetadata();
    return;
  }

  updateMediaSessionMetadata({
    title: song.title,
    artist: song.artist ?? undefined,
    album: song.album ?? undefined,
    coverUrl: buildCoverUrl(song.id) ?? undefined,
    duration: song.duration ?? undefined,
  });

  // Initialize position state with duration if available
  if (typeof song.duration === "number" && song.duration > 0) {
    updateMediaSessionPositionState(0, song.duration);
  }
}

/**
 * Prepare and play a song. This handles URL resolution, state updates,
 * and Media Session sync. Used by next(), previous(), and seekTo().
 */
export async function prepareAndPlaySong(
  song: Song,
  index: number,
  audioPlayer: { play: (track: Track & { resolvedUrl?: string }) => void },
  set: (state: Partial<PlayerState>) => void
): Promise<void> {
  const track = songToTrack(song);
  const resolvedUrl = await prefetchAudioBlob(track.audioUrl);
  const preparedTrack = resolvedUrl ? { ...track, resolvedUrl } : track;

  audioPlayer.play(preparedTrack);
  set({
    currentIndex: index,
    currentSong: song,
    lastPlayedSong: song,
    currentTime: 0,
    isPlaying: true,
  });
  updateMediaSessionForSong(song);
}
