/**
 * Library Service - Cascade Delete Logic
 * 
 * Handles Library deletion with proper cascade logic:
 * 1. Get all songs from library (via song.libraryId)
 * 2. Remove PlaylistSong entries from that library
 * 3. Delete Song metadata (no refcount needed - songs are library-specific)
 * 4. Check fileHash usage by other songs
 * 5. Delete Cache Storage if no other song uses same fileHash
 */

import { db } from "@/lib/db/schema";
import { logger } from "@/lib/logger-client";

// Lazy-load cache-manager to reduce initial bundle size
async function getCacheNameLazy(type: "audio" | "covers"): Promise<string> {
  const { getCacheName } = await import("@/lib/pwa/cache-manager");
  return getCacheName(type);
}

export interface DeleteProgress {
  stage: "librarySongs" | "playlistSongs" | "songs" | "cache" | "library" | "complete";
  total: number;
  current: number;
  message: string;
}

export interface DeleteResult {
  success: boolean;
  deletedPlaylistSongs: number;
  deletedSongs: number;
  deletedCacheEntries: number;
  errors: string[];
}

class LibraryService {
  /**
   * Delete library with cascade logic
   * @param libraryId - Library ID to delete
   * @param onProgress - Progress callback
   * @returns Delete result
   */
  async deleteLibrary(
    libraryId: string,
    onProgress?: (progress: DeleteProgress) => void
  ): Promise<DeleteResult> {
    const result: DeleteResult = {
      success: true,
      deletedPlaylistSongs: 0,
      deletedSongs: 0,
      deletedCacheEntries: 0,
      errors: [],
    };

    try {
      logger.info("[LibraryService][deleteLibrary]", "Starting library deletion", { raw: { libraryId } });

      // Step 1: Get all songs from this library (via song.libraryId)
      const songs = await db.songs.where("libraryId").equals(libraryId).toArray();
      const totalSteps = songs.length;

      onProgress?.({
        stage: "songs",
        total: totalSteps,
        current: 0,
        message: `Found ${songs.length} songs in library`,
      });

      // Step 2: Delete playlistSongs from this library
      onProgress?.({
        stage: "playlistSongs",
        total: totalSteps,
        current: 0,
        message: "Removing songs from playlists",
      });

      // Find all playlistSongs that reference songs from this library
      const songIds = songs.map(s => s.id);
      const playlistSongs = await db.playlistSongs
        .where("songId")
        .anyOf(songIds)
        .toArray();

      // Delete playlistSongs in batch
      await Promise.all(
        playlistSongs.map(ps => db.playlistSongs.delete([ps.playlistId, ps.songId]))
      );
      result.deletedPlaylistSongs = playlistSongs.length;

      // Step 3: Delete songs and cache
      onProgress?.({
        stage: "songs",
        total: totalSteps,
        current: 0,
        message: "Deleting songs and cache",
      });

      const cache = await caches.open(await getCacheNameLazy("audio"));
      let processed = 0;

      for (const song of songs) {
        try {
          processed++;
          
          const songStreamUrl = song.streamUrl;
          const fileId = song.fileId;

          // Use Dexie transaction to ensure atomic check-and-delete
          await db.transaction("rw", [db.songs, db.files], async () => {
            // Delete song metadata FIRST (within transaction)
            await db.songs.delete(song.id);
            result.deletedSongs++;
            logger.debug("[LibraryService][deleteLibrary]", "Song deleted", { raw: { songId: song.id } });

            // Decrement file refCount and check if cache should be deleted
            if (fileId) {
              const file = await db.files.get(fileId);
              if (file) {
                const newRefCount = file.refCount - 1;
                
                if (newRefCount <= 0) {
                  // No more songs reference this file, delete cache and file record
                  await db.files.delete(fileId);
                  
                  if (songStreamUrl) {
                    await cache.delete(songStreamUrl);
                    result.deletedCacheEntries++;
                    logger.debug("[LibraryService][deleteLibrary]", "Cache and file deleted", { raw: { songId: song.id, fileId } });
                  }
                } else {
                  // Update refCount
                  await db.files.update(fileId, { refCount: newRefCount });
                  logger.debug("[LibraryService][deleteLibrary]", "File refCount decremented", { 
                    raw: { songId: song.id, fileId, newRefCount },
                  });
                }
              }
            } else if (songStreamUrl) {
              // No fileId means unique file (old data), safe to delete
              await cache.delete(songStreamUrl);
              result.deletedCacheEntries++;
              logger.debug("[LibraryService][deleteLibrary]", "Cache deleted (unique file)", { raw: { songId: song.id } });
            }
          });

          onProgress?.({
            stage: "songs",
            total: totalSteps,
            current: processed,
            message: `Processing song ${processed}/${totalSteps}`,
          });
        } catch (error) {
          result.errors.push(`Failed to process song ${song.id}: ${String(error)}`);
          logger.error("[LibraryService][deleteLibrary]", "Failed to process song deletion", error, { raw: { songId: song.id } });
        }
      }

      onProgress?.({
        stage: "library",
        total: totalSteps,
        current: totalSteps,
        message: "Deleting library",
      });

      // Step 5: Delete library itself
      await db.libraries.delete(libraryId);

      onProgress?.({
        stage: "complete",
        total: totalSteps,
        current: totalSteps,
        message: "Deletion complete",
      });

      logger.info("[LibraryService][deleteLibrary]", "Library deleted successfully", {
        raw: { libraryId, result },
      });

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`Fatal error: ${String(error)}`);
      logger.error("[LibraryService][deleteLibrary]", "Library deletion failed", error, { raw: { libraryId } });
      return result;
    }
  }

  /**
   * Remove song from library (not used in current flow, but useful for future)
   * @param libraryId - Library ID
   * @param songId - Song ID
   */
  async removeSongFromLibrary(libraryId: string, songId: string): Promise<void> {
    try {
      // Get song to verify it belongs to this library
      const song = await db.songs.get(songId);
      
      if (!song || song.libraryId !== libraryId) {
        logger.warn("[LibraryService][removeSongFromLibrary]", "Song not found in library", { raw: { libraryId, songId } });
        return;
      }

      // Delete playlistSongs that reference this song
      await db.playlistSongs
        .where("songId")
        .equals(songId)
        .delete();

      const songStreamUrl = song.streamUrl;
      const fileId = song.fileId;

      // Use Dexie transaction to ensure atomic check-and-delete
      await db.transaction("rw", [db.songs, db.files], async () => {
        // Delete song metadata (within transaction)
        await db.songs.delete(songId);
        logger.info("[LibraryService][removeSongFromLibrary]", "Song deleted from library", { raw: { songId, libraryId } });

        // Decrement file refCount and check if cache should be deleted
        if (fileId) {
          const file = await db.files.get(fileId);
          if (file) {
            const newRefCount = file.refCount - 1;
            
            if (newRefCount <= 0) {
              // No more songs reference this file, delete cache and file record
              await db.files.delete(fileId);
              
              if (songStreamUrl) {
                const cache = await caches.open(await getCacheNameLazy("audio"));
                await cache.delete(songStreamUrl);
                logger.debug("[LibraryService][removeSongFromLibrary]", "Cache and file deleted", { raw: { songId, fileId } });
              }
            } else {
              // Update refCount
              await db.files.update(fileId, { refCount: newRefCount });
              logger.debug("[LibraryService][removeSongFromLibrary]", "File refCount decremented", { 
                raw: { songId, fileId, newRefCount },
              });
            }
          }
        } else if (songStreamUrl) {
          // No fileId means unique file (old data), safe to delete
          const cache = await caches.open(await getCacheNameLazy("audio"));
          await cache.delete(songStreamUrl);
          logger.debug("[LibraryService][removeSongFromLibrary]", "Cache deleted (unique file)", { raw: { songId } });
        }
      });
    } catch (error) {
      logger.error("[LibraryService][removeSongFromLibrary]", "Failed to remove song from library", error, { raw: { libraryId, songId } });
      throw error;
    }
  }

  /**
   * Get library statistics
   */
  async getLibraryStats(libraryId: string): Promise<{
    songCount: number;
    totalSize: number;
    cachedCount: number;
    cachedSize: number;
  }> {
    try {
      // Get all songs from this library (via song.libraryId)
      const songs = await db.songs.where("libraryId").equals(libraryId).toArray();

      let totalSize = 0;
      let cachedCount = 0;
      let cachedSize = 0;

      for (const song of songs) {
        if (song.isCached && song.cacheSize) {
          cachedCount++;
          cachedSize += song.cacheSize;
        }
        
        totalSize += song.cacheSize || 0;
      }

      return {
        songCount: songs.length,
        totalSize,
        cachedCount,
        cachedSize,
      };
    } catch (error) {
      logger.error("[LibraryService][getLibraryStats]", "Failed to get library stats", error, { raw: { libraryId } });
      return {
        songCount: 0,
        totalSize: 0,
        cachedCount: 0,
        cachedSize: 0,
      };
    }
  }
}

// Singleton instance
export const libraryService = new LibraryService();
