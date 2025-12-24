/**
 * Track Loader Utilities
 * Helper functions for loading playback state and building track queue
 */

import { api } from "@/services";
import { MAIN_API_ENDPOINTS } from "@/services/api/main/endpoints";
import { getPlayQueue } from "@/lib/audio/queue";
import { getPlayContext, type PlayContext } from "@/lib/audio/context";
import { logger } from "@/lib/logger-client";
import { buildCoverUrl } from "@/lib/utils/url";
import type { Track } from "@/lib/audio/player";
import type { Song } from "@m3w/shared";

/**
 * Convert a Song to a Track
 */
export function songToTrack(song: Song): Track {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist ?? undefined,
    album: song.album ?? undefined,
    coverUrl: buildCoverUrl(song.id),
    duration: song.duration ?? undefined,
    audioUrl: MAIN_API_ENDPOINTS.songs.stream(song.id),
    mimeType: song.mimeType ?? "audio/mpeg",
  };
}

/**
 * Convert an array of Songs to Tracks
 */
export function songsToTracks(songs: Song[]): Track[] {
  return songs.map(songToTrack);
}

/**
 * Load tracks from a context (library or playlist)
 */
export async function loadTracksFromContext(
  context: { type?: string; id?: string }
): Promise<{ tracks: Track[]; currentIndex: number } | null> {
  if (!context.type || !context.id) {
    return null;
  }

  try {
    if (context.type === "playlist") {
      const songs = await api.main.playlists.getSongs(context.id);
      if (songs && songs.length > 0) {
        return { tracks: songsToTracks(songs), currentIndex: 0 };
      }
    } else if (context.type === "library") {
      const songs = await api.main.libraries.getSongs(context.id);
      if (songs && songs.length > 0) {
        return { tracks: songsToTracks(songs), currentIndex: 0 };
      }
    }
  } catch (error) {
    logger.error("[TrackLoader][loadTracksFromContext]", "Failed to load tracks from context", error, { raw: { context } });
  }

  return null;
}

/**
 * Setup queue with tracks and context
 */
export function setupQueueWithContext(
  tracks: Track[],
  currentIndex: number,
  context?: PlayContext
): void {
  const queue = getPlayQueue();
  queue.setQueue(tracks, currentIndex);

  if (context) {
    getPlayContext().setContext({
      ...context,
      name: context.name ?? "",
    });
  }
}

/**
 * Find track index in queue by ID
 */
export function findTrackIndex(tracks: Track[], trackId: string): number {
  const index = tracks.findIndex(t => t.id === trackId);
  return index === -1 ? 0 : index;
}

/**
 * Load full queue from a context with a target track
 */
export async function loadFullQueueForTrack(
  track: Track,
  context?: { type?: string; id?: string; name?: string }
): Promise<{ tracks: Track[]; currentIndex: number }> {
  if (!context?.type || !context?.id) {
    return { tracks: [track], currentIndex: 0 };
  }

  const result = await loadTracksFromContext(context);
  if (result && result.tracks.length > 0) {
    const currentIndex = findTrackIndex(result.tracks, track.id);
    logger.info("[TrackLoader][loadFullQueueForTrack]", "Loaded full queue from context", {
      raw: {
        contextType: context.type,
        contextId: context.id,
        tracksCount: result.tracks.length,
        currentIndex
      }
    });
    return { tracks: result.tracks, currentIndex };
  }

  logger.warn("[TrackLoader][loadFullQueueForTrack]", "Failed to load full queue, using single track", { raw: { context } });
  return { tracks: [track], currentIndex: 0 };
}
