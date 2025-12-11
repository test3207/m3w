/**
 * Metadata Cache Helpers
 * 
 * Shared caching logic for storing API responses to IndexedDB.
 * Used by both router-level caching and periodic sync.
 * 
 * Key behaviors:
 * - Preserves local cache status fields (isCached, cacheSize) when updating songs
 * - Handles stale data cleanup for owned libraries
 * - All operations are idempotent and safe to call multiple times
 */

import { db, type OfflineSong } from "../db/schema";
import { logger } from "../logger-client";
import type { Library, Playlist, Song } from "@m3w/shared";

// Storage key for last sync timestamp
const SYNC_STORAGE_KEY = "m3w_last_sync_timestamp";

/**
 * Get last sync timestamp
 */
export function getLastSyncTime(): number | null {
  const stored = localStorage.getItem(SYNC_STORAGE_KEY);
  return stored ? parseInt(stored, 10) : null;
}

/**
 * Update last sync timestamp
 */
export function setLastSyncTime(timestamp: number): void {
  localStorage.setItem(SYNC_STORAGE_KEY, timestamp.toString());
}

/**
 * Cache libraries to IndexedDB
 * Strategy: replace-all (full replacement of libraries table)
 */
export async function cacheLibraries(libraries: Library[]): Promise<void> {
  try {
    await db.libraries.bulkPut(libraries);
    logger.debug("[MetadataCache] Libraries cached", { count: libraries.length });
  } catch (error) {
    logger.error("[MetadataCache] Failed to cache libraries", { error });
    throw error;
  }
}

/**
 * Cache a single library to IndexedDB
 * Strategy: upsert (insert or update)
 */
export async function cacheLibrary(library: Library): Promise<void> {
  try {
    await db.libraries.put(library);
    logger.debug("[MetadataCache] Library cached", { id: library.id });
  } catch (error) {
    logger.error("[MetadataCache] Failed to cache library", { error });
    throw error;
  }
}

/**
 * Cache playlists to IndexedDB
 * Strategy: replace-all (full replacement of playlists table)
 */
export async function cachePlaylists(playlists: Playlist[]): Promise<void> {
  try {
    await db.playlists.bulkPut(playlists);
    logger.debug("[MetadataCache] Playlists cached", { count: playlists.length });
  } catch (error) {
    logger.error("[MetadataCache] Failed to cache playlists", { error });
    throw error;
  }
}

/**
 * Cache a single playlist to IndexedDB
 * Strategy: upsert (insert or update)
 */
export async function cachePlaylist(playlist: Playlist): Promise<void> {
  try {
    await db.playlists.put(playlist);
    logger.debug("[MetadataCache] Playlist cached", { id: playlist.id });
  } catch (error) {
    logger.error("[MetadataCache] Failed to cache playlist", { error });
    throw error;
  }
}

/**
 * Merge songs with existing cache status
 * Preserves isCached, cacheSize, lastCacheCheck, fileHash fields
 */
async function mergeSongsWithCacheStatus(songs: Song[]): Promise<OfflineSong[]> {
  // Get existing songs to preserve cache status
  const songIds = songs.map(s => s.id);
  const existingSongs = await db.songs.where("id").anyOf(songIds).toArray();
  const existingMap = new Map(existingSongs.map(s => [s.id, s]));

  return songs.map((song) => {
    const existing = existingMap.get(song.id);
    return {
      ...song,
      // Preserve existing cache fields or set defaults
      isCached: existing?.isCached ?? false,
      cacheSize: existing?.cacheSize,
      lastCacheCheck: existing?.lastCacheCheck ?? 0,
      fileHash: existing?.fileHash,
    };
  });
}

/**
 * Cache songs for a library to IndexedDB
 * Strategy: replace-by-key (replace all songs for given libraryId)
 * Preserves cache status fields from existing records
 */
export async function cacheSongsForLibrary(
  libraryId: string,
  songs: Song[]
): Promise<void> {
  try {
    const mergedSongs = await mergeSongsWithCacheStatus(songs);
    
    // Delete existing songs for this library that are not in the new list
    const newSongIds = new Set(songs.map(s => s.id));
    const existingSongs = await db.songs.where("libraryId").equals(libraryId).toArray();
    const toDelete = existingSongs.filter(s => !newSongIds.has(s.id)).map(s => s.id);
    
    if (toDelete.length > 0) {
      await db.songs.bulkDelete(toDelete);
      logger.debug("[MetadataCache] Deleted stale songs", { libraryId, count: toDelete.length });
    }
    
    await db.songs.bulkPut(mergedSongs);
    logger.debug("[MetadataCache] Songs cached for library", { libraryId, count: songs.length });
  } catch (error) {
    logger.error("[MetadataCache] Failed to cache songs for library", { libraryId, error });
    throw error;
  }
}

/**
 * Cache songs for a playlist to IndexedDB
 * Strategy: replace-by-key (replace all songs and playlistSongs for given playlistId)
 * Also updates the playlistSongs join table with order
 */
export async function cacheSongsForPlaylist(
  playlistId: string,
  songs: Song[]
): Promise<void> {
  try {
    const mergedSongs = await mergeSongsWithCacheStatus(songs);
    
    // Update songs table (these songs might belong to different libraries)
    await db.songs.bulkPut(mergedSongs);
    
    // Delete existing playlist-song relationships
    await db.playlistSongs.where("playlistId").equals(playlistId).delete();
    
    // Create new playlist-song relationships with order
    const playlistSongRecords = songs.map((song, index) => ({
      playlistId,
      songId: song.id,
      order: index,
      addedAt: new Date().toISOString(),
    }));
    
    await db.playlistSongs.bulkPut(playlistSongRecords);
    logger.debug("[MetadataCache] Songs cached for playlist", { playlistId, count: songs.length });
  } catch (error) {
    logger.error("[MetadataCache] Failed to cache songs for playlist", { playlistId, error });
    throw error;
  }
}

/**
 * Cache a single song to IndexedDB
 * Preserves cache status fields from existing record
 */
export async function cacheSong(song: Song): Promise<void> {
  try {
    const [merged] = await mergeSongsWithCacheStatus([song]);
    await db.songs.put(merged);
    logger.debug("[MetadataCache] Song cached", { id: song.id });
  } catch (error) {
    logger.error("[MetadataCache] Failed to cache song", { error });
    throw error;
  }
}

/**
 * Delete stale songs that no longer exist on server
 * Only deletes from owned libraries (not shared)
 */
export async function deleteStalesSongs(
  serverSongIds: Set<string>,
  ownedLibraryIds: Set<string>
): Promise<number> {
  try {
    const existingSongs = await db.songs.toArray();
    const songsToDelete = existingSongs
      .filter(song => ownedLibraryIds.has(song.libraryId) && !serverSongIds.has(song.id))
      .map(song => song.id);
    
    if (songsToDelete.length > 0) {
      await db.songs.bulkDelete(songsToDelete);
      logger.debug("[MetadataCache] Deleted stale songs", { count: songsToDelete.length });
    }
    
    return songsToDelete.length;
  } catch (error) {
    logger.error("[MetadataCache] Failed to delete stale songs", { error });
    throw error;
  }
}
