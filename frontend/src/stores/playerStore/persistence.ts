/**
 * Player Store Persistence
 * 
 * Functions for loading and saving playback progress to the backend.
 * These are extracted to reduce the main store file size.
 */

import { type Song } from "@m3w/shared";
import { api } from "@/services";
import { logger } from "@/lib/logger-client";
import { getStreamUrl } from "@/services/api/main/endpoints";
import { prefetchAudioBlob } from "@/lib/audio/prefetch";
import { getAudioPlayer } from "@/lib/audio/player";
import { songToTrack } from "./helpers";
import type { QueueSource, PlayerState } from "./types";

/**
 * Convert API track data to a Song object.
 */
export function apiTrackToSong(track: {
  id: string;
  title: string;
  artist?: string | null;
  album?: string | null;
  duration?: number | null;
  mimeType?: string | null;
}): Song {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist ?? null,
    album: track.album ?? null,
    albumArtist: null,
    genre: null,
    year: null,
    trackNumber: null,
    discNumber: null,
    composer: null,
    libraryId: "", // Not available from API
    libraryName: null, // Not available from API
    fileId: "", // Not needed for playback
    duration: track.duration ?? null,
    mimeType: track.mimeType ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Load playback preferences (repeat mode and shuffle) from the backend.
 */
export async function loadPreferences(
  hasUserModifiedPreferences: boolean,
  set: (state: Partial<PlayerState>) => void
): Promise<void> {
  if (hasUserModifiedPreferences) {
    logger.info("Skipped loading preferences - user has local changes");
    return;
  }

  try {
    const preferences = await api.main.player.getPreferences();
    if (preferences) {
      set({
        repeatMode: preferences.repeatMode,
        isShuffled: preferences.shuffleEnabled,
        hasLoadedPreferences: true,
      });
      logger.info("Loaded playback preferences", { 
        repeatMode: preferences.repeatMode, 
        shuffleEnabled: preferences.shuffleEnabled 
      });
    }
  } catch (prefError) {
    logger.warn("Failed to load playback preferences", prefError);
  }
}

/**
 * Load default seed and prime the player.
 */
export async function loadDefaultSeed(
  set: (state: Partial<PlayerState>) => void
): Promise<boolean> {
  try {
    const seed = await api.main.player.getSeed();
    if (!seed?.track) return false;

    const song = apiTrackToSong(seed.track);
    
    set({
      currentSong: song,
      lastPlayedSong: song,
      queue: [song],
      currentIndex: 0,
      queueSource: seed.context.type as QueueSource,
      queueSourceId: seed.context.id,
      queueSourceName: seed.context.name,
      isPlaying: false, // Don't auto-play
    });
    
    // Prime AudioPlayer so it's ready to play
    const track = songToTrack(song);
    getAudioPlayer().prime(track);
    
    logger.info("Loaded default seed and primed player", { songId: song.id, title: song.title });
    return true;
  } catch (seedError) {
    logger.warn("Failed to load default seed", seedError);
    return false;
  }
}

/**
 * Load full queue based on context (playlist or library).
 */
export async function loadQueueFromContext(
  context: { type?: string; id?: string } | undefined,
  currentSongId: string
): Promise<{ queue: Song[]; startIndex: number }> {
  if (!context?.id || !context?.type) {
    return { queue: [], startIndex: 0 };
  }

  try {
    let songs: Song[] = [];
    
    if (context.type === "playlist") {
      songs = await api.main.playlists.getSongs(context.id);
      if (songs.length > 0) {
        logger.info("Loaded playlist queue", { 
          playlistId: context.id, 
          songCount: songs.length
        });
      }
    } else if (context.type === "library") {
      songs = await api.main.libraries.getSongs(context.id);
      if (songs.length > 0) {
        logger.info("Loaded library queue", { 
          libraryId: context.id, 
          songCount: songs.length
        });
      }
    }

    if (songs.length > 0) {
      const startIndex = Math.max(0, songs.findIndex(s => s.id === currentSongId));
      return { queue: songs, startIndex };
    }
  } catch (queueError) {
    logger.warn("Failed to load full queue, using single track", queueError);
  }

  return { queue: [], startIndex: 0 };
}

/**
 * Prime the audio player with a song and seek to position.
 */
export async function primePlayerWithSong(
  song: Song,
  position: number,
  queueLength: number
): Promise<void> {
  const audioUrl = getStreamUrl(song.id);
  const objectUrl = await prefetchAudioBlob(audioUrl);
  
  const track = songToTrack(song);
  
  if (objectUrl) {
    track.resolvedUrl = objectUrl;
    logger.info("Restored playback state with preloaded audio", { 
      songId: song.id, 
      position,
      queueLength 
    });
  } else {
    logger.info("Restored playback state (Guest mode - Service Worker streaming)", { 
      songId: song.id, 
      position,
      queueLength 
    });
  }
  
  const audioPlayer = getAudioPlayer();
  audioPlayer.prime(track);
  audioPlayer.seek(position);
}
